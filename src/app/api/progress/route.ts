import { NextResponse } from "next/server";
import { MongoProgressRepository } from "@/infrastructure/repositories/MongoProgressRepository";

const progressRepository = new MongoProgressRepository();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";
    const courseId = searchParams.get("courseId") || "";

    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameters: userId, courseId" },
        { status: 400 }
      );
    }

    const progress = await progressRepository.findByUserAndCourse(userId, courseId);
    return NextResponse.json({ success: true, data: progress }, { status: 200 });
  } catch (error: any) {
    console.error("GET progress route error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch student progress" },
      { status: 500 }
    );
  }
}
