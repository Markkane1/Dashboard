import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit } from "@/infrastructure/security/rateLimit";

const AUTH_SECRET = process.env.AUTH_SECRET || "elearning-epa-dev-auth-secret-change-me";

export async function middleware(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";
  const path = request.nextUrl.pathname;

  if (path === "/api/auth/callback/credentials" || path.endsWith("quiz-submit")) {
    const limiter = await rateLimit(ip, 5);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  const token = await getToken({ req: request, secret: AUTH_SECRET });

  if (path.startsWith("/courses/") && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/courses/:path*", "/api/auth/callback/credentials", "/api/courses/quiz-submit"],
};
