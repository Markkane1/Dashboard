import mongoose, { Schema, Document } from "mongoose";
import { Progress, QuizAttempt } from "../../../core/domain/entities/Progress";

// Override completedChapters to mongoose.Types.ObjectId[] for database-level schemas
export interface ProgressDocument extends Omit<Progress, "id" | "completedChapters">, Document {
  completedChapters: mongoose.Types.ObjectId[];
}

const QuizAttemptSchema = new Schema<QuizAttempt>(
  {
    scorePercentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    attemptedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const ProgressSchema = new Schema<ProgressDocument>(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    completedChapters: {
      type: [Schema.Types.ObjectId], // Array of ObjectIds tracking completed chapters
      default: [],
    },
    isCourseCompleted: { type: Boolean, required: true, default: false },
    certificateId: { type: String, default: "" },
    quizAttempts: { type: [QuizAttemptSchema], default: [] }, // Nested quiz attempts history
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        // Map ObjectIds in completedChapters to strings for clean domain-level consumption
        if (ret.completedChapters) {
          ret.completedChapters = ret.completedChapters.map((id: any) => id.toString());
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Define a composite unique index on { userId, courseId } to prevent duplicate progress rows
ProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const ProgressModel = mongoose.models.Progress || mongoose.model<ProgressDocument>("Progress", ProgressSchema);
