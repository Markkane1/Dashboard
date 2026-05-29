import { NextResponse } from "next/server";
import { MongoCourseRepository } from "@/infrastructure/repositories/MongoCourseRepository";
import { GetCourseQuizUseCase } from "@/core/use-cases/GetCourseQuiz";

const courseRepository = new MongoCourseRepository();
const getCourseQuizUseCase = new GetCourseQuizUseCase(courseRepository);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("id");

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: "Course ID parameter 'id' is required" },
        { status: 400 }
      );
    }

    // Always fetch quiz with secure projection active (strip correct answers)
    const quiz = await getCourseQuizUseCase.execute(courseId, { secure: true });

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "No quiz published for this course yet" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: quiz }, { status: 200 });
  } catch (error: any) {
    console.error("GET course quiz error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch secure quiz" },
      { status: 500 }
    );
  }
}
