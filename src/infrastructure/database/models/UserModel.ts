import mongoose, { Schema, Document } from "mongoose";
import { User } from "../../../core/domain/entities/User";

export interface UserDocument extends Omit<User, "id">, Document {}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "instructor", "admin"], default: "student" },
    avatar: { type: String, default: "" },
    enrolledCourses: { type: [String], default: [] }, // Array of enrolled course IDs
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password; // Never expose password hash in output
        return ret;
      },
    },
  }
);

export const UserModel = mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);
