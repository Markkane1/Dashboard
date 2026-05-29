import { NextResponse } from "next/server";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";
import { LoginUserUseCase } from "@/core/use-cases/LoginUser";
import { GenerateTokenPairUseCase } from "@/core/use-cases/GenerateTokenPair";
import {
  TokenService,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from "@/infrastructure/security/TokenService";

const userRepository = new MongoUserRepository();
const loginUserUseCase = new LoginUserUseCase(userRepository);
const tokenService = new TokenService();
const generateTokenPairUseCase = new GenerateTokenPairUseCase(tokenService);

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

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await loginUserUseCase.execute(email, password);
    const tokenPair = await generateTokenPairUseCase.execute({
      userId: user.id!,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({ success: true, data: user });
    attachAuthCookies(response, tokenPair.accessToken, tokenPair.refreshToken);
    return response;
  } catch (error: any) {
    console.error("POST login error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Authentication failed" },
      { status: 401 }
    );
  }
}
