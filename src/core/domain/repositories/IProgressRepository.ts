import { Progress } from "../entities/Progress";

export interface IProgressRepository {
  findByUserAndCourse(userId: string, courseId: string): Promise<Progress | null>;
  create(progress: Omit<Progress, "id" | "createdAt" | "updatedAt">): Promise<Progress>;
  completeChapter(userId: string, courseId: string, chapterId: string): Promise<Progress | null>;
  
  // Generic progress updating support
  updateProgress(
    userId: string,
    courseId: string,
    progress: Partial<Progress>
  ): Promise<Progress | null>;
}
