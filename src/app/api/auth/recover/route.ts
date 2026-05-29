import { NextResponse } from "next/server";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";

const userRepository = new MongoUserRepository();

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email address is required" },
        { status: 400 }
      );
    }

    await userRepository.findByEmail(email);

    return NextResponse.json({
      success: true,
      message:
        "If an account exists for that email, recovery instructions will be sent shortly.",
    });
  } catch (error) {
    console.error("POST recover error:", error);
    return NextResponse.json(
      { success: false, error: "Recovery request failed" },
      { status: 500 }
    );
  }
}
