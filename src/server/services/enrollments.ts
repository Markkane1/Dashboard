const { Course, Enrollment } = require('../models');
const { USER_ROLES } = require('../../shared/permissions');
const { getMissingPrerequisiteIds } = require('./courseAccessRules');
const { verifyCourseCompletionRules } = require('./courseCompletion');
import type { Request } from 'express';

async function getEnrollment(userId: unknown, courseId: unknown) {
  return Enrollment.findOne({ userId, courseId });
}

async function isEnrolled(userId: unknown, courseId: unknown): Promise<boolean> {
  return Boolean(await getEnrollment(userId, courseId));
}

async function hasCourseAccess(user: NonNullable<Request['user']>, courseId: unknown): Promise<boolean> {
  if (
    user.id === 'internal-service' ||
    user.role === USER_ROLES.ADMIN ||
    user.role === USER_ROLES.INSTRUCTOR ||
    (Array.isArray(user.roles) && (user.roles.includes(USER_ROLES.ADMIN) || user.roles.includes(USER_ROLES.INSTRUCTOR)))
  ) {
    return true;
  }

  const normalizedCourseId = String(courseId);
  const enrollment = await getEnrollment(user.id, normalizedCourseId);
  if (!enrollment) {
    const completed = await hasCompletedCourse(user.id, normalizedCourseId);
    if (!completed) {
      return false;
    }
  }
  const course = await Course.findById(normalizedCourseId).select('prerequisiteCourseIds publishStatus approvalStatus');
  if (!course || course.publishStatus !== 'published' || course.approvalStatus !== 'approved') {
    return false;
  }

  const missingPrerequisiteIds = await getMissingPrerequisiteIds(user.id, course);
  return missingPrerequisiteIds.length === 0;
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
  getCompletedEnrollments,
  verifyCompletionRules: verifyCourseCompletionRules
};

export {};
