const { Enrollment } = require('../models');
import type { Request } from 'express';

async function getEnrollment(userId: unknown, courseId: unknown) {
  return Enrollment.findOne({ userId, courseId });
}

async function isEnrolled(userId: unknown, courseId: unknown): Promise<boolean> {
  return Boolean(await getEnrollment(userId, courseId));
}

async function hasCourseAccess(user: NonNullable<Request['user']>, courseId: unknown): Promise<boolean> {
  const normalizedCourseId = String(courseId);
  const claimedCourseIds = [
    ...(user.enrolledCourses || []),
    ...(user.completedCourses || [])
  ];

  if (claimedCourseIds.includes(normalizedCourseId)) {
    return true;
  }

  return isEnrolled(user.id, normalizedCourseId);
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
  hasCourseAccess,
  hasCompletedCourse,
  getCompletedCourseIds,
  getCompletedEnrollments
};

export {};
