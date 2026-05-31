import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";

function buildBackendUrl(path: string) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

export async function GET(req: NextRequest, { params }: { params: { certificateId: string } }) {
  const backendUrl = buildBackendUrl(`/api/certificates/verify/${params.certificateId}`);
  const response = await fetch(backendUrl, {
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(req.headers.entries())
    },
    cache: "no-store"
  });

  const body = await response.json().catch(() => ({ error: "Invalid response from backend." }));
  return NextResponse.json(body, { status: response.status });
}
