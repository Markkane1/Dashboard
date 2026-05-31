import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    apiAccessToken?: string;
    user: {
      id: string;
      role?: string;
      avatar?: string;
      enrolledCourses?: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    enrolledCourses?: string[];
    completedCourses?: string[];
    apiAccessToken?: string;
  }
}
