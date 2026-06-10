import { CourseQuiz } from "@/shared/types";
import { cookies, headers } from "next/headers";

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
  const res = await fetch(`${baseUrl}/api/quiz/${encodeURIComponent(courseId)}`, {
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

export async function fetchCourseQuizFromUiApi(courseId: string): Promise<CourseQuiz> {
  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  const host = requestHeaders.get("host");
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");
  const cookieHeader = (await cookies()).toString();

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/courses/quiz?courseId=${encodeURIComponent(courseId)}`, {
    method: "GET",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    cache: "no-store",
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
