export type Category =
  | "biological-diversity"
  | "chemicals-waste"
  | "climate-atmosphere"
  | "environmental-governance"
  | "land-agriculture"
  | "marine-freshwater";

export type Course = {
  id: string;
  title: string;
  category: Category;
  sdgGoals: number[];
  topics: ("mea-introductory" | "human-rights" | "gender")[];
  mea: string[];
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
  diplomaRequiredCourseIds?: string[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  enrolledCourses: string[];
  completedCourses: string[];
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
