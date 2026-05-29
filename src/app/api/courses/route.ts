import { NextResponse } from "next/server";
import { MongoCourseRepository } from "@/infrastructure/repositories/MongoCourseRepository";
import { GetCoursesUseCase } from "@/core/use-cases/GetCourses";
import { GetCourseByIdUseCase } from "@/core/use-cases/GetCourseById";
import { CreateCourseUseCase } from "@/core/use-cases/CreateCourse";

const courseRepository = new MongoCourseRepository();
const getCoursesUseCase = new GetCoursesUseCase(courseRepository);
const getCourseByIdUseCase = new GetCourseByIdUseCase(courseRepository);
const createCourseUseCase = new CreateCourseUseCase(courseRepository);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Check if looking for a specific course (e.g. for Drawer details, containing chapters)
    const id = searchParams.get("id");
    if (id) {
      const course = await getCourseByIdUseCase.execute(id, { includeChapters: true });
      if (!course) {
        return NextResponse.json(
          { success: false, error: "Course syllabus not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: course });
    }

    // Otherwise load optimized list (excluding chapters) for main page performance
    const category = searchParams.get("category") || "";
    const search = searchParams.get("search") || "";

    const courses = await getCoursesUseCase.execute(
      { category, search },
      { includeChapters: false }
    );
    return NextResponse.json({ success: true, data: courses });
  } catch (error: any) {
    console.error("GET courses error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const course = await createCourseUseCase.execute(body);
    return NextResponse.json({ success: true, data: course }, { status: 201 });
  } catch (error: any) {
    console.error("POST course error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create course" },
      { status: 400 }
    );
  }
}
