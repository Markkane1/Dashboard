import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function buildBackendUrl(lessonId: string) {
  return `${BACKEND_URL.replace(/\/$/, "")}/api/video/${encodeURIComponent(lessonId)}`;
}

function getForwardedVideoHeaders(req: NextRequest, token: string) {
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
  });

  const range = req.headers.get("range");
  if (range) headers.set("Range", range);

  const ifRange = req.headers.get("if-range");
  if (ifRange) headers.set("If-Range", ifRange);

  return headers;
}

export async function GET(req: NextRequest, { params }: { params: { lessonId: string } }) {
  const session = await auth();
  if (!session?.apiAccessToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const response = await fetch(buildBackendUrl(params.lessonId), {
    headers: getForwardedVideoHeaders(req, session.apiAccessToken),
    redirect: "manual",
    cache: "no-store",
  });

  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    return NextResponse.redirect(location, response.status);
  }

  const headers = new Headers();
  for (const header of [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ]) {
    const value = response.headers.get(header);
    if (value) headers.set(header, value);
  }
  headers.set("Cache-Control", "no-store");

  return new NextResponse(response.body, {
    status: response.status,
    headers,
  });
}
