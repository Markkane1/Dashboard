import { NextResponse } from "next/server";
import { MongoCourseRepository } from "@/infrastructure/repositories/MongoCourseRepository";
import { MarkdownToPdfCompiler } from "@/infrastructure/services/MarkdownToPdfCompiler";

const courseRepository = new MongoCourseRepository();
const handbookCompiler = new MarkdownToPdfCompiler(courseRepository);

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Resolve courseId from dynamic routing parameters
    const resolvedParams = await context.params;
    const courseId = resolvedParams.courseId;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: "Missing required Course ID parameter" },
        { status: 400 }
      );
    }

    // 2. Execute handbook compiler
    const pdfBytes = await handbookCompiler.compile(courseId);
    
    if (!pdfBytes) {
      return NextResponse.json(
        { success: false, error: "Handbook could not be generated. Verify course curriculum exists." },
        { status: 404 }
      );
    }

    // 3. Stream compiled PDF handbook directly to client
    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="handbook_${courseId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("GET course handbook streaming error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to compile offline handbook" },
      { status: 500 }
    );
  }
}
