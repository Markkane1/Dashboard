import mongoose, { Schema, Document } from "mongoose";
import { User } from "../../../core/domain/entities/User";

export interface UserDocument extends Omit<User, "id">, Document {
  isLocked(): boolean;
}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true, select: false }, // Heavily protected, excluded by default
    role: { type: String, enum: ["student", "instructor", "admin"], default: "student", required: true },
    avatar: { type: String, default: "" },
    enrolledCourses: { type: [String], default: [] },
    loginAttempts: { type: Number, default: 0, required: true },
    lockUntil: { type: Date },
    isVerified: { type: Boolean, default: false, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password; // Never expose password in JSON outputs
        return ret;
      },
    },
  }
);

// Mongoose instance method to check account lock status
UserSchema.methods.isLocked = function (this: UserDocument): boolean {
  if (!this.lockUntil) return false;
  return new Date(this.lockUntil).getTime() > Date.now();
};

export const UserModel = mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);
