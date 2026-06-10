import { USER_ROLES } from "@/shared/permissions";

export interface CourseAccessUser {
  role?: string;
  roles?: string[];
  enrolledCourses?: string[];
  completedCourses?: string[];
}

export function checkCourseAccess(user: CourseAccessUser | null | undefined, courseId: string): boolean {
  if (!user) return false;

  const isAdminOrInstructor =
    user.role === USER_ROLES.ADMIN ||
    user.role === USER_ROLES.INSTRUCTOR ||
    (Array.isArray(user.roles) && (user.roles.includes(USER_ROLES.ADMIN) || user.roles.includes(USER_ROLES.INSTRUCTOR)));

  if (isAdminOrInstructor) {
    return true;
  }

  const enrolled = Array.isArray(user.enrolledCourses) && user.enrolledCourses.includes(courseId);
  const completed = Array.isArray(user.completedCourses) && user.completedCourses.includes(courseId);

  return enrolled || completed;
}
