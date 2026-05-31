export type CourseProgressSummary = {
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
};

export async function fetchCourseProgressSummary(
  courseId: string,
  token: string
): Promise<CourseProgressSummary> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";
  const res = await fetch(`${baseUrl}/api/progress/course/${courseId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch progress summary. Status: ${res.status}`);
  }

  const body = await res.json();
  return body.summary;
}
