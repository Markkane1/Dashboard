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
  quizMaxAttempts?: number;
  quizRandomizeQuestions?: boolean;
  quizRandomizeOptions?: boolean;
  publishStatus?: "draft" | "pending" | "published" | "rejected";
  approvalStatus?: "draft" | "pending" | "approved" | "rejected";
  prerequisiteCourseIds?: string[];
  trainerIds?: string[];
  requiresFeedback?: boolean;
  requiresCertificateApproval?: boolean;
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
  status?: "active" | "pending" | "disabled";
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
  moduleId?: string;
  title: string;
  description?: string;
  order: number;
  videoUrl: string;
  duration: number;
  resources: LessonResource[];
  resourceIds?: string[];
  assignmentIds?: string[];
  transcript?: string;
  isPublished: boolean;
  progress: LessonProgress;
};

export type CourseModule = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  isPublished: boolean;
};

export type CourseResource = {
  id: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  title: string;
  url: string;
  type: "link" | "download" | "document" | "video" | "other";
  isPublished: boolean;
};

export type Assignment = {
  id: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  title: string;
  instructions: string;
  resourceIds: string[];
  dueAt?: string;
  status: "draft" | "published" | "archived";
  mySubmission?: AssignmentSubmission;
};

export type AssignmentSubmission = {
  id: string;
  assignmentId: string;
  courseId: string;
  learnerId: string;
  learnerName?: string;
  learnerEmail?: string;
  text: string;
  linkUrl: string;
  fileUrl: string;
  fileName: string;
  fileMimeType: string;
  status: "submitted" | "approved" | "needs_revision" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComments: string;
  history?: Array<{
    status: "submitted" | "approved" | "needs_revision" | "rejected";
    actorId?: string;
    comments?: string;
    createdAt?: string;
  }>;
  submittedAt?: string;
  updatedAt?: string;
};

export type Cohort = {
  id: string;
  title: string;
  description?: string;
  courseIds: string[];
  trainerIds: string[];
  startsAt?: string;
  endsAt?: string;
  seatLimit?: number;
  status: "draft" | "active" | "completed" | "archived";
};

export type CohortRosterPreview = {
  cohortId: string;
  totalRows: number;
  readyRows: number;
  blockedRows: number;
  seatLimit: number;
  activeCount: number;
  rows: Array<{
    rowNumber: number;
    email: string;
    name: string;
    userId: string;
    status: "ready" | "blocked";
    errors: string[];
  }>;
};

export type CertificateQueueItem = {
  id: string;
  certificateId: string;
  serialNumber: string;
  userId: string;
  learnerName: string;
  learnerEmail: string;
  courseId: string;
  courseTitle: string;
  approvalStatus: "pending" | "approved" | "rejected";
  approvalComments: string;
  issuedAt?: string;
  approvedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
};

export type ReportPreview = {
  type: string;
  rowCount: number;
  sample: Array<Record<string, unknown>>;
};

export type CourseFeedback = {
  id: string;
  userId: string;
  courseId: string;
  rating: number;
  comments?: string;
  answers?: Array<{ question: string; answer: string }>;
};

export type AuditLog = {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
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
  maxAttempts?: number;
  attemptsRemaining?: number;
  questions: QuizQuestion[];
  latestSubmission?: {
    score: number;
    totalQuestions: number;
    passed: boolean;
    attemptNumber?: number;
    attemptsRemaining?: number;
    submittedAt: string;
  } | null;
};
