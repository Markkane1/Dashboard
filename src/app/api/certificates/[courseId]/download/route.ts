import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";

function buildBackendUrl(path: string) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

function getForwardedHeaders(req: NextRequest) {
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (["host", "connection", "content-length"].includes(key)) continue;
    headers.set(key, value);
  }
  return headers;
}

export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  const backendUrl = buildBackendUrl(`/api/certificates/${encodeURIComponent(params.courseId)}/download`);

  const response = await fetch(backendUrl, {
    headers: getForwardedHeaders(req),
    redirect: "manual"
  });

  const forwardedHeaders = new Headers(response.headers);
  return new NextResponse(response.body, {
    status: response.status,
    headers: forwardedHeaders
  });
}
