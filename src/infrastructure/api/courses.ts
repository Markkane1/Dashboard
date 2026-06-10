import { Course } from "@/shared/types";

export type CoursePageParams = {
  limit?: number;
  page?: number;
  cursor?: string;
  category?: string;
  sdg?: string | number;
  section?: string;
  topic?: string;
  mea?: string;
  q?: string;
  isDiploma?: boolean;
  isExternal?: boolean;
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

function getApiPath(path: string) {
  if (typeof window !== "undefined") {
    return `/api/admin${path}`;
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";
  return `${baseUrl.replace(/\/$/, "")}/api${path}`;
}

function buildApiUrl(path: string) {
  const apiPath = getApiPath(path);
  return typeof window !== "undefined"
    ? new URL(apiPath, window.location.origin)
    : new URL(apiPath);
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
  const url = buildApiUrl("/courses");
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

  const res = await fetch(getApiPath("/courses/batch"), {
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
  const res = await fetch(getApiPath(`/courses/${encodeURIComponent(courseId)}`), {
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
