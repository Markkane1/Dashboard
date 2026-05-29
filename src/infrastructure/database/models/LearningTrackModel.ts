import mongoose, { Schema, Document } from "mongoose";
import { LearningTrack } from "../../../core/domain/entities/LearningTrack";

export interface LearningTrackDocument extends Omit<LearningTrack, "id">, Document {}

const LearningTrackSchema = new Schema<LearningTrackDocument>(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    pathway: {
      type: String,
      enum: ["Diploma", "Certificate", "Degree"],
      default: "Diploma",
      index: true,
    },
    requiredCourseIds: {
      type: [String], // Array of course IDs that compose this path
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const LearningTrackModel =
  mongoose.models.LearningTrack ||
  mongoose.model<LearningTrackDocument>("LearningTrack", LearningTrackSchema);
