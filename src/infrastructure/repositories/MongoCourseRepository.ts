import { ICourseRepository } from "../../core/domain/repositories/ICourseRepository";
import { Course } from "../../core/domain/entities/Course";
import { CourseModel } from "../database/models/CourseModel";
import { dbConnect } from "../database/mongodb";

export class MongoCourseRepository implements ICourseRepository {
  async findAll(
    filter?: { category?: string; search?: string },
    options?: { includeChapters?: boolean }
  ): Promise<Course[]> {
    await dbConnect();
    const query: Record<string, any> = {};
    
    if (filter) {
      if (filter.category && filter.category !== "All" && filter.category.trim() !== "") {
        query.category = filter.category;
      }
      if (filter.search && filter.search.trim() !== "") {
        query.$or = [
          { title: { $regex: filter.search, $options: "i" } },
          { description: { $regex: filter.search, $options: "i" } },
        ];
      }
    }
    
    const dbQuery = CourseModel.find(query).sort({ createdAt: -1 });
    
    if (options && options.includeChapters === false) {
      dbQuery.select("-modules");
    }
    
    const docs = await dbQuery.exec();
    return docs.map((doc) => doc.toJSON() as Course);
  }

  async findById(
    id: string,
    options?: { includeChapters?: boolean }
  ): Promise<Course | null> {
    await dbConnect();
    try {
      const dbQuery = CourseModel.findById(id);
      
      if (options && options.includeChapters === false) {
        dbQuery.select("-modules");
      }
      
      const doc = await dbQuery.exec();
      if (!doc) return null;
      return doc.toJSON() as Course;
    } catch (e) {
      console.error(`Error finding course by id ${id}:`, e);
      return null;
    }
  }

  async create(course: Omit<Course, "id" | "createdAt" | "updatedAt">): Promise<Course> {
    await dbConnect();
    const doc = new CourseModel(course);
    await doc.save();
    return doc.toJSON() as Course;
  }

  async update(id: string, course: Partial<Course>): Promise<Course | null> {
    await dbConnect();
    try {
      const doc = await CourseModel.findByIdAndUpdate(
        id,
        { $set: course },
        { new: true }
      ).exec();
      if (!doc) return null;
      return doc.toJSON() as Course;
    } catch (e) {
      console.error(`Error updating course ${id}:`, e);
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    try {
      const result = await CourseModel.findByIdAndDelete(id).exec();
      return result !== null;
    } catch (e) {
      console.error(`Error deleting course ${id}:`, e);
      return false;
    }
  }

  // Securely retrieve the quiz with/without correct answer mappings projected
  async findQuizByCourseId(
    courseId: string,
    options?: { secure?: boolean }
  ): Promise<any | null> {
    await dbConnect();
    const secure = options?.secure !== false; // defaults to true
    try {
      const dbQuery = CourseModel.findById(courseId);
      
      if (secure) {
        // Select ONLY the questions text/options, projecting OUT correctOptionIndex entirely
        dbQuery.select("quiz.passingScorePercentage quiz.questions.text quiz.questions.options");
      } else {
        dbQuery.select("quiz");
      }

      const doc = await dbQuery.exec();
      if (!doc || !doc.quiz) return null;
      return doc.quiz;
    } catch (e) {
      console.error(`Error retrieving quiz for course ${courseId}:`, e);
      return null;
    }
  }
}
