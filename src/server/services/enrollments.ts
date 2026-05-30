const { Enrollment } = require('../models');

async function getEnrollment(userId: unknown, courseId: unknown) {
  return Enrollment.findOne({ userId, courseId });
}

async function isEnrolled(userId: unknown, courseId: unknown): Promise<boolean> {
  return Boolean(await getEnrollment(userId, courseId));
}

async function hasCompletedCourse(userId: unknown, courseId: unknown): Promise<boolean> {
  return Boolean(await Enrollment.findOne({ userId, courseId, completed: true }));
}

async function getCompletedCourseIds(userId: unknown): Promise<string[]> {
  const enrollments = await getCompletedEnrollments(userId);
  return enrollments.map((enrollment: { courseId: { toString(): string } }) => enrollment.courseId.toString());
}

async function getCompletedEnrollments(userId: unknown) {
  return Enrollment.find({ userId, completed: true }).select('courseId completedAt createdAt updatedAt');
}

module.exports = {
  getEnrollment,
  isEnrolled,
  hasCompletedCourse,
  getCompletedCourseIds,
  getCompletedEnrollments
};

export {};
