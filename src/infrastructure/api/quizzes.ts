import { CourseQuiz } from "@/shared/types";

export class QuizApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "QuizApiError";
    this.status = status;
  }
}

export async function fetchCourseQuiz(courseId: string, token: string): Promise<CourseQuiz> {
  const baseUrl = process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/quiz/${courseId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!res.ok) {
    let errorMessage = `Failed to fetch quiz. Status: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) errorMessage = body.error;
    } catch {}
    throw new QuizApiError(errorMessage, res.status);
  }

  return res.json();
}
