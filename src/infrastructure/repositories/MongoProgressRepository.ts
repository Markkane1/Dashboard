import { IProgressRepository } from "../../core/domain/repositories/IProgressRepository";
import { Progress } from "../../core/domain/entities/Progress";
import { ProgressModel } from "../database/models/ProgressModel";
import { dbConnect } from "../database/mongodb";

export class MongoProgressRepository implements IProgressRepository {
  async findByUserAndCourse(userId: string, courseId: string): Promise<Progress | null> {
    await dbConnect();
    const doc = await ProgressModel.findOne({ userId, courseId }).exec();
    if (!doc) return null;
    return doc.toJSON() as Progress;
  }

  async create(progress: Omit<Progress, "id" | "createdAt" | "updatedAt">): Promise<Progress> {
    await dbConnect();
    const doc = new ProgressModel(progress);
    await doc.save();
    return doc.toJSON() as Progress;
  }

  async completeChapter(userId: string, courseId: string, chapterId: string): Promise<Progress | null> {
    await dbConnect();
    const doc = await ProgressModel.findOneAndUpdate(
      { userId, courseId },
      { $addToSet: { completedChapters: chapterId } },
      { new: true, upsert: true }
    ).exec();
    return doc.toJSON() as Progress;
  }

  async updateProgress(
    userId: string,
    courseId: string,
    progress: Partial<Progress>
  ): Promise<Progress | null> {
    await dbConnect();
    try {
      const doc = await ProgressModel.findOneAndUpdate(
        { userId, courseId },
        { $set: progress },
        { new: true, upsert: true } // Upserts tracker details if missing
      ).exec();
      return doc.toJSON() as Progress;
    } catch (e) {
      console.error(`Error updating progress for user ${userId} and course ${courseId}:`, e);
      return null;
    }
  }
}
