import { NextResponse } from "next/server";
import { MongoProgressRepository } from "@/infrastructure/repositories/MongoProgressRepository";
import { CompleteChapterUseCase } from "@/core/use-cases/CompleteChapter";

const progressRepository = new MongoProgressRepository();
const completeChapterUseCase = new CompleteChapterUseCase(progressRepository);

export async function POST(request: Request) {
  try {
    const { userId, courseId, chapterId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Student session context is required" },
        { status: 401 }
      );
    }

    const progress = await completeChapterUseCase.execute(userId, courseId, chapterId);
    return NextResponse.json({ success: true, data: progress }, { status: 200 });
  } catch (error: any) {
    console.error("POST complete chapter route error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to mark chapter complete" },
      { status: 400 }
    );
  }
}
