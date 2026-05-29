import { ILearningTrackRepository } from "../domain/repositories/ILearningTrackRepository";
import { IProgressRepository } from "../domain/repositories/IProgressRepository";
import { LearningTrack } from "../domain/entities/LearningTrack";

export interface DiplomaEvaluationResult {
  isEligible: boolean;
  requiredCoursesCount: number;
  completedCoursesCount: number;
  completedCourseIds: string[];
  missingCourseIds: string[];
  track: LearningTrack;
}

export class EvaluateDiplomaUseCase {
  constructor(
    private learningTrackRepository: ILearningTrackRepository,
    private progressRepository: IProgressRepository
  ) {}

  async execute(userId: string, trackId: string): Promise<DiplomaEvaluationResult> {
    if (!userId || !trackId) {
      throw new Error("User ID and Track ID are required for diploma evaluation");
    }

    // 1. Fetch Learning Track by ID
    const track = await this.learningTrackRepository.findById(trackId);
    if (!track) {
      throw new Error("Learning track not found");
    }

    const requiredIds = track.requiredCourseIds || [];
    const completedCourseIds: string[] = [];
    const missingCourseIds: string[] = [];

    // 2. Query student progress for each course
    for (const courseId of requiredIds) {
      const progress = await this.progressRepository.findByUserAndCourse(userId, courseId);
      if (progress && progress.isCourseCompleted) {
        completedCourseIds.push(courseId);
      } else {
        missingCourseIds.push(courseId);
      }
    }

    // 3. Verify if completion list matches prerequisites
    const isEligible = completedCourseIds.length === requiredIds.length && requiredIds.length > 0;

    return {
      isEligible,
      requiredCoursesCount: requiredIds.length,
      completedCoursesCount: completedCourseIds.length,
      completedCourseIds,
      missingCourseIds,
      track,
    };
  }
}
