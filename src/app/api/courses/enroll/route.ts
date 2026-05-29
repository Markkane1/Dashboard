import { NextResponse } from "next/server";
import { MongoCourseRepository } from "@/infrastructure/repositories/MongoCourseRepository";
import { MongoProgressRepository } from "@/infrastructure/repositories/MongoProgressRepository";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";
import { EnrollInCourseUseCase } from "@/core/use-cases/EnrollInCourse";

const courseRepository = new MongoCourseRepository();
const progressRepository = new MongoProgressRepository();
const userRepository = new MongoUserRepository();
const enrollInCourseUseCase = new EnrollInCourseUseCase(
  courseRepository,
  progressRepository,
  userRepository
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, courseId } = body;

    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: userId, courseId" },
        { status: 400 }
      );
    }

    const progress = await enrollInCourseUseCase.execute(userId, courseId);
    
    // Retrieve the fully updated user object to sync local state
    const updatedUser = await userRepository.findById(userId);

    return NextResponse.json(
      {
        success: true,
        message: "Enrolled in course successfully.",
        data: {
          progress,
          user: updatedUser,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("POST /api/courses/enroll error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to enroll in course" },
      { status: 400 }
    );
  }
}
