export const USER_ROLES = {
  STUDENT: "student",
  INSTRUCTOR: "instructor",
  ADMIN: "admin",
  SERVICE: "service",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ALL_USER_ROLES = Object.values(USER_ROLES) as UserRole[];
export const ASSIGNABLE_USER_ROLES = [
  USER_ROLES.STUDENT,
  USER_ROLES.INSTRUCTOR,
  USER_ROLES.ADMIN,
] as const;

export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

export const PERMISSIONS = {
  MANAGE_CONTENT: "content:manage",
  VIEW_ANALYTICS: "analytics:view",
  ANNOUNCE_NOTIFICATIONS: "notifications:announce",
  READ_USERS: "users:read",
  MANAGE_USERS: "users:manage",
  MANAGE_PASSWORD_RESETS: "password-resets:manage",
  MANAGE_TAXONOMIES: "taxonomies:manage",
  ENROLL_COURSE: "courses:enroll",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [USER_ROLES.ADMIN]: ALL_PERMISSIONS,
  [USER_ROLES.INSTRUCTOR]: [
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.ENROLL_COURSE,
  ],
  [USER_ROLES.STUDENT]: [PERMISSIONS.ENROLL_COURSE],
  [USER_ROLES.SERVICE]: [
    PERMISSIONS.READ_USERS,
    PERMISSIONS.MANAGE_PASSWORD_RESETS,
  ],
};

export function isUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && ALL_USER_ROLES.includes(role as UserRole);
}

export function isAssignableUserRole(role: unknown): role is AssignableUserRole {
  return typeof role === "string" && ASSIGNABLE_USER_ROLES.includes(role as AssignableUserRole);
}

export function normalizeUserRole(role: unknown, fallback: UserRole = USER_ROLES.STUDENT): UserRole {
  return isUserRole(role) ? role : fallback;
}

export function isPermission(permission: unknown): permission is Permission {
  return typeof permission === "string" && ALL_PERMISSIONS.includes(permission as Permission);
}

export function normalizePermissions(permissions: unknown): Permission[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return [...new Set(permissions.filter(isPermission))];
}

export function getPermissionsForRole(role: string | undefined | null): Permission[] {
  return [...ROLE_PERMISSIONS[normalizeUserRole(role)]];
}

export function roleHasPermission(role: string | undefined | null, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function hasPermission(
  user: { role?: string | null; permissions?: unknown } | undefined | null,
  permission: Permission
): boolean {
  if (!user) return false;
  return normalizePermissions(user.permissions).includes(permission) || roleHasPermission(user.role, permission);
}

export default {
  USER_ROLES,
  ALL_USER_ROLES,
  ASSIGNABLE_USER_ROLES,
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  isUserRole,
  isAssignableUserRole,
  normalizeUserRole,
  isPermission,
  normalizePermissions,
  roleHasPermission,
  hasPermission,
  getPermissionsForRole,
};
