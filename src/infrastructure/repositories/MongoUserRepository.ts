import { IUserRepository } from "../../core/domain/repositories/IUserRepository";
import { User } from "../../core/domain/entities/User";
import { UserModel } from "../database/models/UserModel";
import { dbConnect } from "../database/mongodb";

export class MongoUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    await dbConnect();
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).exec();
    if (!doc) return null;
    return doc.toJSON() as User;
  }

  async findById(id: string): Promise<User | null> {
    await dbConnect();
    const doc = await UserModel.findById(id).exec();
    if (!doc) return null;
    return doc.toJSON() as User;
  }

  async create(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    await dbConnect();
    const doc = new UserModel({
      ...user,
      email: user.email.toLowerCase(),
    });
    await doc.save();
    return doc.toJSON() as User;
  }

  async update(id: string, user: Partial<User>): Promise<User | null> {
    await dbConnect();
    try {
      const doc = await UserModel.findByIdAndUpdate(
        id,
        { $set: user },
        { new: true }
      ).exec();
      if (!doc) return null;
      return doc.toJSON() as User;
    } catch (e) {
      console.error(`Error updating user ${id}:`, e);
      return null;
    }
  }
}
