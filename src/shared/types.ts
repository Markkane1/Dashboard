import type { Permission, UserRole } from "./permissions";

export type Category = string;

export type Course = {
  id: string;
  title: string;
  category: string;
  sdgGoals: number[];
  sections?: string[];
  topics: string[];
  mea?: string[];
  syllabusUrl?: string;
  courseUrl: string;
  isDiploma: boolean;
  isExternal: boolean;
  externalUrl?: string;
  description?: string;
  instructorId?: string;
  instructorName?: string;
  instructorAvatar?: string;
  price?: number;
  thumbnail?: string;
  duration?: string;
  lessonsCount?: number;
  rating?: number;
  enrolledCount?: number;
  quizPassingScore?: number;
  quizQuestions?: AuthoredQuizQuestion[];
  diplomaRequiredCourseIds?: string[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  roles?: string[];
  permissions?: Permission[];
  directPermissions?: Permission[];
  avatar?: string;
  enrolledCourses: string[];
  completedCourses: string[];
  emailVerified?: boolean;
  createdAt?: string;
};

export type Role = {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  system: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LessonResource = {
  label: string;
  url: string;
};

export type LessonProgress = {
  watchedSeconds: number;
  completed: boolean;
};

export type Lesson = {
  _id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  videoUrl: string;
  duration: number;
  resources: LessonResource[];
  transcript?: string;
  isPublished: boolean;
  progress: LessonProgress;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export type AuthoredQuizQuestion = QuizQuestion & {
  correctAnswerIndex: number;
  explanation?: string;
};

export type CourseQuiz = {
  courseId: string;
  courseTitle: string;
  passingScore: number;
  questions: QuizQuestion[];
  latestSubmission?: {
    score: number;
    totalQuestions: number;
    passed: boolean;
    submittedAt: string;
  } | null;
};
