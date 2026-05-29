import { ICourseRepository } from "../domain/repositories/ICourseRepository";
import { Course } from "../domain/entities/Course";

export class CreateCourseUseCase {
  constructor(private courseRepository: ICourseRepository) {}

  async execute(input: Omit<Course, "id" | "createdAt" | "updatedAt">): Promise<Course> {
    if (!input.title || input.title.trim() === "") {
      throw new Error("Course title is required");
    }
    if (!input.description || input.description.trim() === "") {
      throw new Error("Course description is required");
    }
    if (input.price < 0) {
      throw new Error("Course price cannot be negative");
    }
    if (!input.thumbnail) {
      input.thumbnail = "/images/course-placeholder.jpg"; // Default generic path
    }

    return this.courseRepository.create({
      ...input,
      rating: input.rating ?? 4.5,
      enrolledCount: input.enrolledCount ?? 0,
    });
  }
}
