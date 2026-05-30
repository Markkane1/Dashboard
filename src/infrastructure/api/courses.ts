import { Course } from "@/shared/types";

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
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/courses`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new ApiError(`Failed to fetch courses. Status: ${res.status}`, res.status);
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
