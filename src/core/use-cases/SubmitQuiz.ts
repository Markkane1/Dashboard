import { ICourseRepository } from "../domain/repositories/ICourseRepository";
import { IProgressRepository } from "../domain/repositories/IProgressRepository";
import { Progress, QuizAttempt } from "../domain/entities/Progress";
import crypto from "crypto";

export interface GradingReport {
  scorePercentage: number;
  passed: boolean;
  passingScorePercentage: number;
  correctCount: number;
  totalQuestions: number;
  certificateId?: string;
}

export class SubmitQuizUseCase {
  constructor(
    private courseRepository: ICourseRepository,
    private progressRepository: IProgressRepository
  ) {}

  async execute(
    userId: string,
    courseId: string,
    selectedOptionIndices: number[]
  ): Promise<GradingReport> {
    if (!userId || !courseId || !selectedOptionIndices) {
      throw new Error("User ID, Course ID, and selected options are required");
    }

    // 1. Retrieve the quiz payload securely server-side (obtain correct answer indices)
    const quiz = await this.courseRepository.findQuizByCourseId(courseId, { secure: false });
    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
      throw new Error("No quiz syllabus registered for this course");
    }

    const questions = quiz.questions;
    const totalQuestions = questions.length;
    let correctCount = 0;

    // 2. Grade indices server-side
    for (let i = 0; i < totalQuestions; i++) {
      const submittedAns = selectedOptionIndices[i];
      const correctAns = questions[i].correctOptionIndex;
      
      if (submittedAns !== undefined && submittedAns === correctAns) {
        correctCount++;
      }
    }

    // 3. Calculate score results
    const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
    const passed = scorePercentage >= quiz.passingScorePercentage;

    // 4. Fetch or instantiate the student progress tracker
    let progress = await this.progressRepository.findByUserAndCourse(userId, courseId);
    if (!progress) {
      progress = await this.progressRepository.create({
        userId,
        courseId,
        completedChapters: [],
        isCourseCompleted: false,
      });
    }

    // 5. Append new Quiz Attempt
    const newAttempt: QuizAttempt = {
      scorePercentage,
      passed,
      attemptedAt: new Date(),
    };

    const attempts = progress.quizAttempts || [];
    attempts.push(newAttempt);

    const progressUpdates: Partial<Progress> = {
      quizAttempts: attempts,
    };

    let certificateId = progress.certificateId;

    // 6. If passed, complete course and issue unique certificate hash
    if (passed) {
      progressUpdates.isCourseCompleted = true;
      
      // Generate a secure unique cryptographic hash if not already issued
      if (!certificateId || certificateId.trim() === "") {
        const certData = `${userId}-${courseId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        certificateId = crypto.createHash("sha256").update(certData).digest("hex");
        progressUpdates.certificateId = certificateId;
      }
    }

    // 7. Commit changes back to MongoDB
    await this.progressRepository.updateProgress(userId, courseId, progressUpdates);

    // 8. Return grading report
    return {
      scorePercentage,
      passed,
      passingScorePercentage: quiz.passingScorePercentage,
      correctCount,
      totalQuestions,
      certificateId: passed ? certificateId : undefined,
    };
  }
}
