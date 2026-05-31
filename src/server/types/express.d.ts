declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email?: string;
      role?: string;
      permissions?: string[];
      name?: string;
      enrolledCourses?: string[];
      completedCourses?: string[];
      [key: string]: unknown;
    };
    contentManager?: unknown;
  }
}
