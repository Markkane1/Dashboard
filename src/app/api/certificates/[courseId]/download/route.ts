import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

export const runtime = "nodejs";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";

function buildBackendUrl(path: string) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

function getForwardedHeaders(req: NextRequest, token: string) {
  const headers = new Headers({
    Authorization: `Bearer ${token}`
  });
  for (const [key, value] of req.headers.entries()) {
    if (["host", "connection", "content-length", "authorization"].includes(key)) continue;
    headers.set(key, value);
  }
  return headers;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await auth();
  if (!session?.apiAccessToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const resolvedParams = await params;
  const backendUrl = buildBackendUrl(`/api/certificates/${encodeURIComponent(resolvedParams.courseId)}/download`);

  const response = await fetch(backendUrl, {
    headers: getForwardedHeaders(req, session.apiAccessToken),
    redirect: "manual"
  });

  const forwardedHeaders = new Headers(response.headers);
  return new NextResponse(response.body, {
    status: response.status,
    headers: forwardedHeaders
  });
}
