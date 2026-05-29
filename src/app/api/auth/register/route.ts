import { NextResponse } from "next/server";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";
import { RegisterUserUseCase } from "@/core/use-cases/RegisterUser";

const userRepository = new MongoUserRepository();
const registerUserUseCase = new RegisterUserUseCase(userRepository);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await registerUserUseCase.execute(body);
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error: any) {
    console.error("POST register error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Registration failed" },
      { status: 400 }
    );
  }
}
