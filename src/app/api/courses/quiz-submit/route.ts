import { NextResponse } from "next/server";
import { MongoCourseRepository } from "@/infrastructure/repositories/MongoCourseRepository";
import { MongoProgressRepository } from "@/infrastructure/repositories/MongoProgressRepository";
import { SubmitQuizUseCase } from "@/core/use-cases/SubmitQuiz";

const courseRepository = new MongoCourseRepository();
const progressRepository = new MongoProgressRepository();
const submitQuizUseCase = new SubmitQuizUseCase(courseRepository, progressRepository);

export async function POST(request: Request) {
  try {
    const { userId, courseId, selectedOptionIndices } = await request.json();

    if (!userId || !courseId || !selectedOptionIndices) {
      return NextResponse.json(
        { success: false, error: "Missing required arguments: userId, courseId, selectedOptionIndices" },
        { status: 400 }
      );
    }

    const report = await submitQuizUseCase.execute(userId, courseId, selectedOptionIndices);
    return NextResponse.json({ success: true, data: report }, { status: 200 });
  } catch (error: any) {
    console.error("POST submit quiz error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to grade quiz submission" },
      { status: 400 }
    );
  }
}
