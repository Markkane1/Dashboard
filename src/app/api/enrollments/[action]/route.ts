import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

export const runtime = "nodejs";

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const ACTIONS: Record<string, string> = {
  complete: "/api/users/complete",
  enroll: "/api/users/enroll",
  unenroll: "/api/users/unenroll",
};

function backendUrl(path: string) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  const session = await auth();
  const backendPath = ACTIONS[params.action];
  if (!session?.apiAccessToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!backendPath) {
    return NextResponse.json({ error: "Unknown enrollment action." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const response = await fetch(backendUrl(backendPath), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.apiAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
