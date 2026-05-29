import { IUserRepository } from "../../core/domain/repositories/IUserRepository";
import { User } from "../../core/domain/entities/User";
import { UserModel } from "../database/models/UserModel";
import { dbConnect } from "../database/mongodb";

export class MongoUserRepository implements IUserRepository {
  private mapDocumentToUser(doc: any): User {
    const obj = doc.toObject();
    const user: User = {
      id: obj._id.toString(),
      name: obj.name,
      email: obj.email,
      password: obj.password, // Explicitly mapped so hashes stay available in-memory for interactors
      role: obj.role,
      avatar: obj.avatar,
      enrolledCourses: obj.enrolledCourses,
      loginAttempts: obj.loginAttempts,
      lockUntil: obj.lockUntil,
      isVerified: obj.isVerified,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    await dbConnect();
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).select("+password").exec();
    if (!doc) return null;
    return this.mapDocumentToUser(doc);
  }

  async findById(id: string): Promise<User | null> {
    await dbConnect();
    const doc = await UserModel.findById(id).select("+password").exec();
    if (!doc) return null;
    return this.mapDocumentToUser(doc);
  }

  async create(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    await dbConnect();
    const doc = new UserModel({
      ...user,
      email: user.email.toLowerCase(),
    });
    await doc.save();
    return this.mapDocumentToUser(doc);
  }

  async update(id: string, user: Partial<User>): Promise<User | null> {
    await dbConnect();
    try {
      const doc = await UserModel.findByIdAndUpdate(
        id,
        { $set: user },
        { new: true }
      ).select("+password").exec();
      if (!doc) return null;
      return this.mapDocumentToUser(doc);
    } catch (e) {
      console.error(`Error updating user ${id}:`, e);
      return null;
    }
  }
}
