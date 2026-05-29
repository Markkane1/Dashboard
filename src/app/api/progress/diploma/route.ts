import { NextResponse } from "next/server";
import { MongoLearningTrackRepository } from "@/infrastructure/repositories/MongoLearningTrackRepository";
import { MongoProgressRepository } from "@/infrastructure/repositories/MongoProgressRepository";
import { EvaluateDiplomaUseCase } from "@/core/use-cases/EvaluateDiploma";

const learningTrackRepository = new MongoLearningTrackRepository();
const progressRepository = new MongoProgressRepository();
const evaluateDiplomaUseCase = new EvaluateDiplomaUseCase(
  learningTrackRepository,
  progressRepository
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const trackId = searchParams.get("trackId");

    if (!userId || !trackId) {
      return NextResponse.json(
        { success: false, error: "Missing query parameters: userId and trackId" },
        { status: 400 }
      );
    }

    const evaluation = await evaluateDiplomaUseCase.execute(userId, trackId);
    return NextResponse.json({ success: true, data: evaluation }, { status: 200 });
  } catch (error: any) {
    console.error("GET diploma evaluation route error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to evaluate diploma eligibility" },
      { status: 500 }
    );
  }
}
