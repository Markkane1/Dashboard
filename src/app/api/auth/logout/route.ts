import { NextResponse } from "next/server";
import { TokenService, ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_EXPIRES_MS } from "@/infrastructure/security/TokenService";

const tokenService = new TokenService();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
};

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

export async function POST(request: Request) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
    if (refreshToken) {
      await tokenService.revokeRefreshToken(refreshToken);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" }, { status: 200 });
    clearAuthCookies(response);
    return response;
  } catch (error: any) {
    console.error("POST logout error:", error);
    const response = NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
    clearAuthCookies(response);
    return response;
  }
}
