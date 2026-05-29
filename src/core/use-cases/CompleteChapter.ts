import { IProgressRepository } from "../domain/repositories/IProgressRepository";
import { Progress } from "../domain/entities/Progress";

export class CompleteChapterUseCase {
  constructor(private progressRepository: IProgressRepository) {}

  async execute(
    userId: string,
    courseId: string,
    chapterId: string
  ): Promise<Progress | null> {
    if (!userId || !courseId || !chapterId) {
      throw new Error("User ID, Course ID, and Chapter ID are required parameters");
    }

    return this.progressRepository.completeChapter(userId, courseId, chapterId);
  }
}
