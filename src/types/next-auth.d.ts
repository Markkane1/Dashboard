import { UserRole } from "@/core/domain/entities/User";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      avatar?: string;
      enrolledCourses?: string[];
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    enrolledCourses?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    enrolledCourses?: string[];
  }
}
