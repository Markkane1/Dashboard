import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

export const runtime = "nodejs";

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.apiAccessToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required." }, { status: 400 });
  }

  const backendUrl = `${BACKEND_URL.replace(/\/$/, "")}/api/quiz/${encodeURIComponent(courseId)}`;
  
  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.apiAccessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Failed to fetch quiz from backend." }, { status: 500 });
  }
}
