import { Course } from "../entities/Course";

export interface ICourseRepository {
  findAll(
    filter?: { category?: string; search?: string },
    options?: { includeChapters?: boolean }
  ): Promise<Course[]>;
  
  findById(
    id: string,
    options?: { includeChapters?: boolean }
  ): Promise<Course | null>;
  
  create(course: Omit<Course, "id" | "createdAt" | "updatedAt">): Promise<Course>;
  update(id: string, course: Partial<Course>): Promise<Course | null>;
  delete(id: string): Promise<boolean>;
  
  // Secure Quiz retrieval mapping
  findQuizByCourseId(
    courseId: string,
    options?: { secure?: boolean }
  ): Promise<any | null>;
}
