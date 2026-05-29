import { ICourseRepository } from "../domain/repositories/ICourseRepository";
import { Course } from "../domain/entities/Course";

export class GetCourseByIdUseCase {
  constructor(private courseRepository: ICourseRepository) {}

  async execute(
    id: string,
    options?: { includeChapters?: boolean }
  ): Promise<Course | null> {
    if (!id) {
      throw new Error("Course ID is required");
    }
    return this.courseRepository.findById(id, options);
  }
}
