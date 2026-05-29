import { NextResponse } from "next/server";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";
import { LoginUserUseCase } from "@/core/use-cases/LoginUser";

const userRepository = new MongoUserRepository();
const loginUserUseCase = new LoginUserUseCase(userRepository);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await loginUserUseCase.execute(email, password);
    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    console.error("POST login error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Authentication failed" },
      { status: 401 }
    );
  }
}
