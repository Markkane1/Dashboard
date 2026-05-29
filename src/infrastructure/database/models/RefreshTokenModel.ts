import mongoose, { Schema, Document } from "mongoose";

export interface RefreshTokenDocument extends Document {
  userId: string;
  token: string;
  revoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    revoked: { type: Boolean, default: false, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL Index: automatically deletes document upon expiry
  },
  {
    timestamps: true,
  }
);

export const RefreshTokenModel =
  mongoose.models.RefreshToken ||
  mongoose.model<RefreshTokenDocument>("RefreshToken", RefreshTokenSchema);
