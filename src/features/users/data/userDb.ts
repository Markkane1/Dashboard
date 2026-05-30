import { connectMongo } from "@/server/db/mongoose";
import UserModel from "@/server/models/User";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  avatar?: string;
  enrolledCourses?: string[];
  completedCourses?: string[];
  createdAt: string;
}

function serializeUser(user: any): StoredUser {
  const plain = typeof user.toObject === "function" ? user.toObject() : user;

  return {
    id: String(plain._id || plain.id),
    name: plain.name,
    email: plain.email,
    password: plain.password,
    role: plain.role || "student",
    avatar: plain.avatar || "",
    enrolledCourses: plain.enrolledCourses || [],
    completedCourses: plain.completedCourses || [],
    createdAt: plain.createdAt instanceof Date
      ? plain.createdAt.toISOString()
      : plain.createdAt || new Date().toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  try {
    await connectMongo();
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    return user ? serializeUser(user) : null;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return null;
  }
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  try {
    await connectMongo();
    const user = await UserModel.findById(id);
    return user ? serializeUser(user) : null;
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }
}

export async function updateUser(id: string, updatedFields: Partial<StoredUser>): Promise<StoredUser | null> {
  try {
    await connectMongo();
    const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...fields } = updatedFields;
    const user = await UserModel.findByIdAndUpdate(id, { $set: fields }, { new: true });
    return user ? serializeUser(user) : null;
  } catch (error) {
    console.error("Error updating user:", error);
    return null;
  }
}

export async function saveUser(user: StoredUser): Promise<StoredUser> {
  try {
    await connectMongo();
    const createdUser = await UserModel.create({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role || "student",
      avatar: user.avatar || "",
      enrolledCourses: user.enrolledCourses || [],
      completedCourses: user.completedCourses || [],
    });

    return serializeUser(createdUser);
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
}
