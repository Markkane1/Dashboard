import mongoose, { Schema, Document } from "mongoose";
import { Course, CourseModule, Chapter, CourseQuiz, QuizQuestion } from "../../../core/domain/entities/Course";

export interface CourseDocument extends Omit<Course, "id">, Document {}

const ChapterSchema = new Schema<Chapter>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    contentMarkdown: { type: String, required: true },
    estimatedMinutes: { type: Number, required: true },
  },
  { _id: false }
);

const ModuleSchema = new Schema<CourseModule>(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    chapters: { type: [ChapterSchema], default: [] },
  },
  { _id: false }
);

const QuizQuestionSchema = new Schema<QuizQuestion>(
  {
    text: { type: String, required: true },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true }, // Protected answer index
  },
  { _id: false }
);

const CourseQuizSchema = new Schema<CourseQuiz>(
  {
    passingScorePercentage: { type: Number, required: true, default: 80 },
    questions: { type: [QuizQuestionSchema], default: [] },
  },
  { _id: false }
);

const CourseSchema = new Schema<CourseDocument>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    instructorId: { type: String, required: true },
    instructorName: { type: String, required: true },
    instructorAvatar: { type: String, default: "" },
    price: { type: Number, required: true },
    thumbnail: { type: String, required: true },
    category: { type: String, required: true },
    duration: { type: String, required: true },
    lessonsCount: { type: Number, required: true },
    rating: { type: Number, default: 4.5 },
    enrolledCount: { type: Number, default: 0 },
    modules: { type: [ModuleSchema], default: [] },
    quiz: { type: CourseQuizSchema, default: null }, // Nested quiz subdocument
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

export const CourseModel = mongoose.models.Course || mongoose.model<CourseDocument>("Course", CourseSchema);
