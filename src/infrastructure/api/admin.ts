import { Course, Role, User } from "@/shared/types";
import { PermissionCatalogItem } from "@/shared/permissions";

const getBaseUrl = () => process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";

function authHeaders(token: string) {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export type AnalyticsOverview = {
  users: number;
  courses: number;
  enrollments: number;
  completedEnrollments: number;
  completionRate: number;
  progressRecords: number;
  quizSubmissions: number;
  averageQuizScore: number;
  quizPassRate: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  averageLessonCompletionRate: number;
  averageLessonWatchRate: number;
  topCourses: Array<{
    courseId: string;
    title: string;
    enrollments: number;
    completions: number;
    completionRate: number;
  }>;
};

export type CourseAnalytics = {
  courseId: string;
  title: string;
  enrollments: number;
  completions: number;
  completionRate: number;
  dropOffRate: number;
  activeLearners: number;
  weeklyActiveLearners: number;
  quizAttempts: number;
  averageQuizScore: number;
  quizPassRate: number;
  averageLessonCompletionRate: number;
  averageLessonWatchRate: number;
};

export async function fetchAdminUsers(token: string): Promise<User[]> {
  const res = await fetch(`${getBaseUrl()}/api/users?limit=50`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch users: ${res.status}`);
  }

  return res.json();
}

export async function fetchRoles(token: string): Promise<Role[]> {
  const res = await fetch(`${getBaseUrl()}/api/roles`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch roles: ${res.status}`);
  }

  return res.json();
}

export async function fetchPermissionCatalog(token: string): Promise<PermissionCatalogItem[]> {
  const res = await fetch(`${getBaseUrl()}/api/roles/permissions`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch permissions: ${res.status}`);
  }

  return res.json();
}

export async function fetchAnalyticsOverview(token: string): Promise<AnalyticsOverview> {
  const res = await fetch(`${getBaseUrl()}/api/analytics/overview`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch analytics: ${res.status}`);
  }

  return res.json();
}

export async function fetchManageableCourses(token: string): Promise<Course[]> {
  const res = await fetch(`${getBaseUrl()}/api/courses?limit=50`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch courses: ${res.status}`);
  }

  return res.json();
}

export async function fetchCourseAnalytics(courseId: string, token: string): Promise<CourseAnalytics> {
  const res = await fetch(`${getBaseUrl()}/api/analytics/courses/${courseId}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch course analytics: ${res.status}`);
  }

  return res.json();
}
