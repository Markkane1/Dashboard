export interface QuizAttempt {
  scorePercentage: number;
  passed: boolean;
  attemptedAt: Date;
}

export interface Progress {
  id?: string;
  userId: string;
  courseId: string;
  completedChapters: string[]; // List of completed chapter identifiers (slugs/ObjectIds)
  isCourseCompleted: boolean;
  certificateId?: string;
  quizAttempts?: QuizAttempt[]; // Track quiz score attempts
  createdAt?: Date;
  updatedAt?: Date;
}
