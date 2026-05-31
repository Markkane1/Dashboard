import jwt from "jsonwebtoken";
import { env } from "@/env";
import { getPermissionsForRole, normalizePermissions, normalizeUserRole } from "@/shared/permissions";

export const API_TOKEN_ISSUER = "next-auth";
export const API_TOKEN_AUDIENCE = "express-api";
export const API_TOKEN_USE = "api";

interface ApiTokenUser {
  id: string;
  email: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  enrolledCourses?: string[];
  completedCourses?: string[];
}

export function signApiAccessToken(
  user: ApiTokenUser,
  expiresIn: jwt.SignOptions["expiresIn"] = "1h"
) {
  const role = normalizeUserRole(user.role);
  const permissions = normalizePermissions(user.permissions);

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role,
      roles: user.roles && user.roles.length > 0 ? user.roles : [role],
      permissions: permissions.length > 0 ? permissions : getPermissionsForRole(role),
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
