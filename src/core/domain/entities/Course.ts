export interface Chapter {
  title: string;
  slug: string;
  contentMarkdown: string;
  estimatedMinutes: number;
}

export interface CourseModule {
  title: string;
  description?: string;
  chapters: Chapter[];
}

export interface QuizQuestion {
  text: string;
  options: string[];
  correctOptionIndex?: number; // Optional so it can be omitted in secure API responses
}

export interface CourseQuiz {
  passingScorePercentage: number;
  questions: QuizQuestion[];
}

export interface Course {
  id?: string;
  title: string;
  description: string;
  instructorId: string;
  instructorName: string;
  instructorAvatar?: string;
  price: number;
  thumbnail: string;
  category: string;
  duration: string;
  lessonsCount: number;
  rating?: number;
  enrolledCount?: number;
  modules?: CourseModule[];
  quiz?: CourseQuiz; // Add quiz object
  createdAt?: Date;
  updatedAt?: Date;
}
