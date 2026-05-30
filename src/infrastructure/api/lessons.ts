import { Lesson } from "@/shared/types";

export class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Fetch all lessons for a specific course using the user's JWT from session.
 * @param courseId - The ID of the course
 * @param token - NextAuth session user JWT access token
 */
export async function fetchCourseLessons(courseId: string, token: string): Promise<Lesson[]> {
  const baseUrl = process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/lessons/course/${courseId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!res.ok) {
    let errorMessage = `Failed to fetch course lessons. Status code: ${res.status}`;
    try {
      const errorBody = await res.json();
      if (errorBody && errorBody.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Ignore JSON parse failures
    }
    throw new ApiError(errorMessage, res.status);
  }

  return res.json();
}

/**
 * Fetch details of a specific lesson (including the full transcript) and user progress.
 * @param lessonId - The ID of the lesson
 * @param token - NextAuth session user JWT access token
 */
export async function fetchLesson(lessonId: string, token: string): Promise<Lesson> {
  const baseUrl = process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/lessons/${lessonId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!res.ok) {
    let errorMessage = `Failed to fetch lesson details. Status code: ${res.status}`;
    try {
      const errorBody = await res.json();
      if (errorBody && errorBody.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Ignore JSON parse failures
    }
    throw new ApiError(errorMessage, res.status);
  }

  return res.json();
}
