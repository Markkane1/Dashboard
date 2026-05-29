import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/infrastructure/security/rateLimit";
import {
  TokenService,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from "@/infrastructure/security/TokenService";

const tokenService = new TokenService();
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
};

function isPublicPath(path: string) {
  return (
    path.startsWith("/api/auth") ||
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    /\.[^/]+$/.test(path)
  );
}

function attachAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
    ...COOKIE_OPTIONS,
    secure,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...COOKIE_OPTIONS,
    secure,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

function clearAuthCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", {
    ...COOKIE_OPTIONS,
    secure,
    maxAge: 0,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, "", {
    ...COOKIE_OPTIONS,
    secure,
    maxAge: 0,
  });
}

export async function middleware(request: NextRequest) {
  const ip = (request as any).ip || "127.0.0.1";
  const path = request.nextUrl.pathname;

  console.log(`[Middleware Intercept] Path: ${path} | Client IP: ${ip}`);

  if (path === "/api/auth/login" || path.endsWith("quiz-submit")) {
    const limiter = await rateLimit(ip, 5);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  if (!accessToken) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const verifiedPayload = tokenService.verifyAccessToken(accessToken);
  if (verifiedPayload) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  if (!refreshToken) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const refreshUrl = new URL("/api/auth/refresh", request.url);
  const refreshResponse = await fetch(refreshUrl.toString(), {
    method: "POST",
    headers: {
      cookie: `${REFRESH_TOKEN_COOKIE_NAME}=${refreshToken}`,
    },
  });

  if (refreshResponse.ok) {
    const body = await refreshResponse.json().catch(() => null);
    const response = NextResponse.next();

    if (
      body?.data?.accessToken &&
      body?.data?.refreshToken
    ) {
      attachAuthCookies(
        response,
        body.data.accessToken,
        body.data.refreshToken
      );
    }

    return response;
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|favicon.ico|robots.txt).*)"],
};
