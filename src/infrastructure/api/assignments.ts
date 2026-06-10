import { Assignment } from "@/shared/types";

export async function fetchCourseAssignments(courseId: string, token: string): Promise<Assignment[]> {
  const baseUrl = process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/assignments/course/${encodeURIComponent(courseId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}
