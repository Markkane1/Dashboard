import { NextRequest, NextResponse } from "next/server";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";
import { GenerateTokenPairUseCase } from "@/core/use-cases/GenerateTokenPair";
import {
  TokenService,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  UserTokenPayload,
} from "@/infrastructure/security/TokenService";

const tokenService = new TokenService();
const tokenPairUseCase = new GenerateTokenPairUseCase(tokenService);
const userRepository = new MongoUserRepository();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
};

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

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
    if (!refreshToken) {
      const response = NextResponse.json(
        { success: false, error: "Refresh token not found" },
        { status: 401 }
      );
      clearAuthCookies(response);
      return response;
    }

    const userId = await tokenService.verifyRefreshToken(refreshToken);
    if (!userId) {
      const response = NextResponse.json(
        { success: false, error: "Refresh token invalid or revoked" },
        { status: 401 }
      );
      clearAuthCookies(response);
      return response;
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      const response = NextResponse.json(
        { success: false, error: "User not found" },
        { status: 401 }
      );
      clearAuthCookies(response);
      return response;
    }

    const payload: UserTokenPayload = {
      userId: user.id!,
      email: user.email,
      role: user.role,
    };

    await tokenService.revokeRefreshToken(refreshToken);
    const tokenPair = await tokenPairUseCase.execute(payload);

    const response = NextResponse.json(
      { success: true, data: tokenPair },
      { status: 200 }
    );
    attachAuthCookies(response, tokenPair.accessToken, tokenPair.refreshToken);
    return response;
  } catch (error: any) {
    console.error("POST refresh error:", error);
    const response = NextResponse.json(
      { success: false, error: "Token refresh failed" },
      { status: 500 }
    );
    clearAuthCookies(response);
    return response;
  }
}
