export type UserRole = "student" | "instructor" | "admin";

export interface User {
  id?: string;
  name: string;
  email: string;
  password?: string; // Stored hashed in infrastructure, optional when returning user
  role: UserRole;
  avatar?: string;
  enrolledCourses?: string[]; // Array of course IDs the user is currently enrolled in
  loginAttempts?: number;
  lockUntil?: Date;
  isVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Utility function to check if the account is currently frozen due to repeated failed entry attempts.
 */
export function isUserLocked(user: User): boolean {
  if (!user.lockUntil) return false;
  return new Date(user.lockUntil).getTime() > Date.now();
}
