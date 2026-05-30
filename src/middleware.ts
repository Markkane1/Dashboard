import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/infrastructure/security/rateLimit";

export async function middleware(request: NextRequest) {
  const ip = (request as any).ip || "127.0.0.1";
  const path = request.nextUrl.pathname;

  console.log(`[Middleware Intercept] Path: ${path} | Client IP: ${ip}`);

  // Apply strict rate-limiting (5 requests/minute) for login and quiz submission
  if (path === "/api/auth/login" || path.endsWith("quiz-submit")) {
    const limiter = await rateLimit(ip, 5);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
