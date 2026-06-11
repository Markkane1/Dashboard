import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { validateServerActionOrigin } from "@/shared/security/serverActionCsrf";

export const runtime = "nodejs";

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function POST(req: NextRequest) {
  try {
    await validateServerActionOrigin();
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await auth();
  if (!session?.apiAccessToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { courseId, answers } = await req.json().catch(() => ({}));
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    }

    const backendUrl = `${BACKEND_URL.replace(/\/$/, "")}/api/quiz/${encodeURIComponent(courseId)}/submit`;

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.apiAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answers }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Failed to submit quiz to backend." }, { status: 500 });
  }
}
