import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { validateServerActionOrigin } from "@/shared/security/serverActionCsrf";

export const runtime = "nodejs";

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getBackendUrl(path: string[], search: string) {
  const baseUrl = BACKEND_URL.replace(/\/$/, "");
  const backendPath = path.map((part) => encodeURIComponent(part)).join("/");
  return `${baseUrl}/api/${backendPath}${search}`;
}

async function getForwardedHeaders(req: NextRequest) {
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (["host", "connection", "content-length"].includes(key)) continue;
    headers.set(key, value);
  }

  if (!headers.has("authorization")) {
    const session = await auth();
    if (session?.apiAccessToken) {
      headers.set("authorization", `Bearer ${session.apiAccessToken}`);
    }
  }

  return headers;
}

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!["GET", "HEAD"].includes(req.method)) {
    try {
      await validateServerActionOrigin();
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }

  const resolvedParams = await params;
  const response = await fetch(getBackendUrl(resolvedParams.path, req.nextUrl.search), {
    method: req.method,
    headers: await getForwardedHeaders(req),
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    redirect: "manual",
    // Required when forwarding a streamed request body from an App Router route.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const headers = new Headers(response.headers);
  return new NextResponse(response.body, {
    status: response.status,
    headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
