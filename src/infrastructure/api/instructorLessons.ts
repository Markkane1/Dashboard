import { Lesson } from "@/shared/types";

export async function fetchManageableLessons(courseId: string, token: string): Promise<Lesson[]> {
  const baseUrl = process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/lessons/manage/course/${encodeURIComponent(courseId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!res.ok) {
    let message = `Failed to fetch lessons. Status: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}
