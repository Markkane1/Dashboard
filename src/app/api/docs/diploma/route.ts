import { NextResponse } from "next/server";
import { MongoCourseRepository } from "@/infrastructure/repositories/MongoCourseRepository";
import { MongoProgressRepository } from "@/infrastructure/repositories/MongoProgressRepository";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";
import { MongoLearningTrackRepository } from "@/infrastructure/repositories/MongoLearningTrackRepository";
import { EvaluateDiplomaUseCase } from "@/core/use-cases/EvaluateDiploma";
import { GenerateDiplomaUseCase } from "@/core/use-cases/GenerateDiploma";
import crypto from "crypto";

const courseRepository = new MongoCourseRepository();
const progressRepository = new MongoProgressRepository();
const userRepository = new MongoUserRepository();
const learningTrackRepository = new MongoLearningTrackRepository();

const evaluateDiplomaUseCase = new EvaluateDiplomaUseCase(
  learningTrackRepository,
  progressRepository
);
const generateDiplomaUseCase = new GenerateDiplomaUseCase();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const trackId = searchParams.get("trackId");

    if (!userId || !trackId) {
      return NextResponse.json(
        { success: false, error: "Missing parameters: userId and trackId" },
        { status: 400 }
      );
    }

    // 1. Evaluate diploma eligibility
    const evaluation = await evaluateDiplomaUseCase.execute(userId, trackId);
    if (!evaluation.isEligible) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Forbidden: You have completed ${evaluation.completedCoursesCount}/${evaluation.requiredCoursesCount} required courses. Complete all courses in the path first!` 
        },
        { status: 403 }
      );
    }

    // 2. Fetch graduate profile and completed course titles in parallel
    const user = await userRepository.findById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "Student record not found" }, { status: 404 });
    }

    const courseTitles: string[] = [];
    for (const courseId of evaluation.completedCourseIds) {
      const course = await courseRepository.findById(courseId, { includeChapters: false });
      if (course) {
        courseTitles.push(course.title);
      }
    }

    // 3. Generate graduation details
    const dateText = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const diplomaHash = crypto
      .createHash("sha256")
      .update(`${userId}-${trackId}-diploma-graduation-hash`)
      .digest("hex");

    // 4. Build A4 Landscape Diploma PDF Buffer
    const pdfBytes = await generateDiplomaUseCase.execute(
      user.name,
      evaluation.track.title,
      courseTitles,
      dateText,
      diplomaHash
    );

    // 5. Stream compiled PDF back to browser
    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="diploma_${trackId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("GET diploma streaming route error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to stream diploma PDF" },
      { status: 500 }
    );
  }
}
