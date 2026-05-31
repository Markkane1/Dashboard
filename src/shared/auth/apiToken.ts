import jwt from "jsonwebtoken";
import { env } from "@/env";

export const API_TOKEN_ISSUER = "next-auth";
export const API_TOKEN_AUDIENCE = "express-api";
export const API_TOKEN_USE = "api";

interface ApiTokenUser {
  id: string;
  email: string;
  role?: string;
  enrolledCourses?: string[];
  completedCourses?: string[];
}

export function signApiAccessToken(
  user: ApiTokenUser,
  expiresIn: jwt.SignOptions["expiresIn"] = "1h"
) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || "student",
      enrolledCourses: user.enrolledCourses || [],
      completedCourses: user.completedCourses || [],
      tokenUse: API_TOKEN_USE,
    },
    env.AUTH_SECRET,
    {
      subject: user.id,
      issuer: API_TOKEN_ISSUER,
      audience: API_TOKEN_AUDIENCE,
      expiresIn,
    }
  );
}
