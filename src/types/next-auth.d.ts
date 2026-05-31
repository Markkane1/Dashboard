import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";
import type { Permission, UserRole } from "@/shared/permissions";

declare module "next-auth" {
  interface Session {
    apiAccessToken?: string;
    user: {
      id: string;
      role?: UserRole;
      roles?: string[];
      permissions?: Permission[];
      avatar?: string;
      enrolledCourses?: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    roles?: string[];
    permissions?: Permission[];
    enrolledCourses?: string[];
    completedCourses?: string[];
    apiAccessToken?: string;
  }
}
