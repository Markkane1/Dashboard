import { NextResponse } from "next/server";
import { MongoCourseRepository } from "@/infrastructure/repositories/MongoCourseRepository";
import { MongoProgressRepository } from "@/infrastructure/repositories/MongoProgressRepository";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";
import { GenerateCertificateUseCase } from "@/core/use-cases/GenerateCertificate";

const courseRepository = new MongoCourseRepository();
const progressRepository = new MongoProgressRepository();
const userRepository = new MongoUserRepository();
const generateCertificateUseCase = new GenerateCertificateUseCase();

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Resolve courseId from dynamic routing parameters
    const resolvedParams = await context.params;
    const courseId = resolvedParams.courseId;

    // 2. Parse userId from query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: userId and courseId" },
        { status: 400 }
      );
    }

    // 3. Verify student completion status via Progress tracking
    const progress = await progressRepository.findByUserAndCourse(userId, courseId);
    if (!progress || !progress.isCourseCompleted || !progress.certificateId) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Forbidden: You must pass the syllabus quiz with a passing score to unlock your certificate." 
        },
        { status: 403 }
      );
    }

    // 4. Load User Profile and Course Details to draw credentials
    const user = await userRepository.findById(userId);
    const course = await courseRepository.findById(courseId);

    if (!user || !course) {
      return NextResponse.json(
        { success: false, error: "Referenced user or course records do not exist" },
        { status: 404 }
      );
    }

    // Format completion date
    const completionDate = progress.updatedAt 
      ? new Date(progress.updatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    // 5. Generate Certificate PDF Buffer
    const pdfBytes = await generateCertificateUseCase.execute(
      user.name,
      course.title,
      completionDate,
      progress.certificateId
    );

    // 6. Return streaming PDF response directly to browser
    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="certificate_${courseId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("GET certificate streaming error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to stream certificate PDF" },
      { status: 500 }
    );
  }
}
