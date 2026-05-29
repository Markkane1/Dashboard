import { ICourseRepository } from "../domain/repositories/ICourseRepository";

export class GetCourseQuizUseCase {
  constructor(private courseRepository: ICourseRepository) {}

  async execute(
    courseId: string,
    options?: { secure?: boolean }
  ): Promise<any | null> {
    if (!courseId) {
      throw new Error("Course ID is required to fetch a quiz syllabus");
    }

    return this.courseRepository.findQuizByCourseId(courseId, options);
  }
}
