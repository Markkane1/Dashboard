import { ICourseRepository } from "../domain/repositories/ICourseRepository";
import { Course } from "../domain/entities/Course";

export class GetCoursesUseCase {
  constructor(private courseRepository: ICourseRepository) {}

  async execute(
    filter?: { category?: string; search?: string },
    options?: { includeChapters?: boolean }
  ): Promise<Course[]> {
    return this.courseRepository.findAll(filter, options);
  }
}
