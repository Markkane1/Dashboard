export type UserRole = "student" | "instructor" | "admin";

export interface User {
  id?: string;
  name: string;
  email: string;
  password?: string; // Stored hashed in infrastructure, optional when returning user
  role: UserRole;
  avatar?: string;
  enrolledCourses?: string[]; // Array of course IDs the user is currently enrolled in
  createdAt?: Date;
  updatedAt?: Date;
}
