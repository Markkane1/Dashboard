import { Course } from "@/shared/types";

export type CoursePageParams = {
  limit?: number;
  page?: number;
  cursor?: string;
  category?: string;
  sdg?: string | number;
  topic?: string;
  mea?: string;
  q?: string;
};

export type CoursePage = {
  courses: Course[];
  totalCount: number;
  nextCursor?: string;
};

export class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Fetch all courses from the backend.
 */
export async function fetchCourses(): Promise<Course[]> {
  const page = await fetchCoursePage({ limit: 60 });
  return page.courses;
}

/**
 * Fetch a paginated course catalog page from the backend.
 */
export async function fetchCoursePage(params: CoursePageParams = {}): Promise<CoursePage> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";
  const url = new URL(`${baseUrl}/api/courses`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new ApiError(`Failed to fetch courses. Status: ${res.status}`, res.status);
  }

  return {
    courses: await res.json(),
    totalCount: Number(res.headers.get("X-Total-Count") || 0),
    nextCursor: res.headers.get("X-Next-Cursor") || undefined,
  };
}

/**
 * Fetch only the requested courses from the backend.
 */
export async function fetchCoursesByIds(courseIds: string[]): Promise<Course[]> {
  if (courseIds.length === 0) {
    return [];
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/courses/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: [...new Set(courseIds)] }),
    cache: "no-store"
  });

  if (!res.ok) {
    throw new ApiError(`Failed to fetch course batch. Status: ${res.status}`, res.status);
  }

  return res.json();
}

/**
 * Fetch a specific course by ID.
 */
export async function fetchCourseById(courseId: string): Promise<Course> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/courses/${courseId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new ApiError(`Failed to fetch course details. Status: ${res.status}`, res.status);
  }

  return res.json();
}
