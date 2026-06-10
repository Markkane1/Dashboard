import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

export const runtime = "nodejs";

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getForwardedHeaders(req: NextRequest) {
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (["host", "connection", "content-length"].includes(key)) continue;
    headers.set(key, value);
  }
  return headers;
}

export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  const session = await auth();
  if (!session?.apiAccessToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const backendUrl = `${BACKEND_URL.replace(/\/$/, "")}/api/docs/${encodeURIComponent(params.courseId)}/download`;

  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        ...Object.fromEntries(getForwardedHeaders(req).entries()),
        "Authorization": `Bearer ${session.apiAccessToken}`,
      },
      cache: "no-store",
    });

    const forwardedHeaders = new Headers(response.headers);
    return new NextResponse(response.body, {
      status: response.status,
      headers: forwardedHeaders,
    });
  } catch {
    return NextResponse.json({ error: "Failed to download certificate from backend." }, { status: 500 });
  }
}
