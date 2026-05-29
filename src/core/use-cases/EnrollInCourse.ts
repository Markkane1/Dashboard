import { ICourseRepository } from "../domain/repositories/ICourseRepository";
import { IProgressRepository } from "../domain/repositories/IProgressRepository";
import { IUserRepository } from "../domain/repositories/IUserRepository";
import { Progress } from "../domain/entities/Progress";

export class EnrollInCourseUseCase {
  constructor(
    private courseRepository: ICourseRepository,
    private progressRepository: IProgressRepository,
    private userRepository: IUserRepository
  ) {}

  async execute(userId: string, courseId: string): Promise<Progress> {
    if (!userId || !courseId) {
      throw new Error("User ID and Course ID are required");
    }

    // 1. Verify via ICourseRepository that the course exists
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // 2. Verify via IProgressRepository that no existing progress record exists
    const existingProgress = await this.progressRepository.findByUserAndCourse(userId, courseId);
    if (existingProgress) {
      throw new Error("Already enrolled in this course");
    }

    // 3. Instantiate a fresh Progress record
    const progress = await this.progressRepository.create({
      userId,
      courseId,
      completedChapters: [],
      isCourseCompleted: false,
    });

    // 4. Update the User entity to push the courseId into their enrolledCourses array using IUserRepository
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const enrolled = user.enrolledCourses || [];
    if (!enrolled.includes(courseId)) {
      enrolled.push(courseId);
      await this.userRepository.update(userId, { enrolledCourses: enrolled });
    }

    return progress;
  }
}
