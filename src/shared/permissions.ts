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
  ACCESS_DASHBOARD: "page:dashboard",
  ACCESS_ADMIN: "page:admin",
  ACCESS_INSTRUCTOR: "page:instructor",
  MANAGE_CONTENT: "content:manage",
  VIEW_ANALYTICS: "analytics:view",
  ANNOUNCE_NOTIFICATIONS: "notifications:announce",
  READ_USERS: "users:read",
  MANAGE_USERS: "users:manage",
  MANAGE_PASSWORD_RESETS: "password-resets:manage",
  MANAGE_TAXONOMIES: "taxonomies:manage",
  ENROLL_COURSE: "courses:enroll",
  APPROVE_COURSES: "courses:approve",
  MANAGE_COHORTS: "cohorts:manage",
  APPROVE_CERTIFICATES: "certificates:approve",
  REVOKE_CERTIFICATES: "certificates:revoke",
  EXPORT_REPORTS: "reports:export",
  VIEW_AUDIT_LOGS: "audit-logs:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export type PermissionScope = "page" | "module" | "action";

export type PermissionCatalogItem = {
  id: Permission;
  label: string;
  description: string;
  scope: PermissionScope;
  module: string;
};

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  {
    id: PERMISSIONS.ACCESS_DASHBOARD,
    label: "Access dashboard",
    description: "Open learner dashboard pages.",
    scope: "page",
    module: "Learner",
  },
  {
    id: PERMISSIONS.ACCESS_ADMIN,
    label: "Access admin",
    description: "Open the admin dashboard.",
    scope: "page",
    module: "Administration",
  },
  {
    id: PERMISSIONS.ACCESS_INSTRUCTOR,
    label: "Access instructor",
    description: "Open instructor workspace pages.",
    scope: "page",
    module: "Instructor",
  },
  {
    id: PERMISSIONS.MANAGE_CONTENT,
    label: "Manage content",
    description: "Create and edit courses, lessons, quizzes, and uploads.",
    scope: "module",
    module: "Content",
  },
  {
    id: PERMISSIONS.VIEW_ANALYTICS,
    label: "View analytics",
    description: "View learning analytics and reporting screens.",
    scope: "module",
    module: "Analytics",
  },
  {
    id: PERMISSIONS.ANNOUNCE_NOTIFICATIONS,
    label: "Send announcements",
    description: "Send platform-wide notifications.",
    scope: "action",
    module: "Notifications",
  },
  {
    id: PERMISSIONS.READ_USERS,
    label: "Read users",
    description: "View user accounts and profiles.",
    scope: "module",
    module: "Users",
  },
  {
    id: PERMISSIONS.MANAGE_USERS,
    label: "Manage users",
    description: "Create, update, and assign users, roles, and permissions.",
    scope: "module",
    module: "Users",
  },
  {
    id: PERMISSIONS.MANAGE_PASSWORD_RESETS,
    label: "Manage password resets",
    description: "Issue and store password reset tokens.",
    scope: "action",
    module: "Security",
  },
  {
    id: PERMISSIONS.MANAGE_TAXONOMIES,
    label: "Manage taxonomies",
    description: "Create and edit categories, SDGs, sections, and topics.",
    scope: "module",
    module: "Taxonomies",
  },
  {
    id: PERMISSIONS.ENROLL_COURSE,
    label: "Enroll in courses",
    description: "Enroll and unenroll learner courses.",
    scope: "action",
    module: "Courses",
  },
  {
    id: PERMISSIONS.APPROVE_COURSES,
    label: "Approve courses",
    description: "Approve or reject course publishing requests.",
    scope: "action",
    module: "Courses",
  },
  {
    id: PERMISSIONS.MANAGE_COHORTS,
    label: "Manage cohorts",
    description: "Create training batches, assign trainers, and manage learner rosters.",
    scope: "module",
    module: "Cohorts",
  },
  {
    id: PERMISSIONS.APPROVE_CERTIFICATES,
    label: "Approve certificates",
    description: "Approve official certificate issuance after course completion.",
    scope: "action",
    module: "Certificates",
  },
  {
    id: PERMISSIONS.REVOKE_CERTIFICATES,
    label: "Revoke certificates",
    description: "Revoke issued certificates with an auditable reason.",
    scope: "action",
    module: "Certificates",
  },
  {
    id: PERMISSIONS.EXPORT_REPORTS,
    label: "Export reports",
    description: "Download compliance reports as Excel-compatible CSV or PDF.",
    scope: "action",
    module: "Reports",
  },
  {
    id: PERMISSIONS.VIEW_AUDIT_LOGS,
    label: "View audit logs",
    description: "Inspect security and compliance audit trails.",
    scope: "module",
    module: "Audit",
  },
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [USER_ROLES.ADMIN]: ALL_PERMISSIONS,
  [USER_ROLES.INSTRUCTOR]: [
    PERMISSIONS.ACCESS_DASHBOARD,
    PERMISSIONS.ACCESS_INSTRUCTOR,
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.ENROLL_COURSE,
  ],
  [USER_ROLES.STUDENT]: [
    PERMISSIONS.ACCESS_DASHBOARD,
    PERMISSIONS.ENROLL_COURSE,
  ],
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

export function normalizeRoles(roles: unknown, fallback: UserRole[] = [USER_ROLES.STUDENT]): string[] {
  const rawRoles = Array.isArray(roles) ? roles : [];
  const normalized = rawRoles
    .map((role) => String(role || "").trim())
    .filter(Boolean);

  return [...new Set(normalized.length > 0 ? normalized : fallback)];
}

export function getPermissionsForRole(role: string | undefined | null): Permission[] {
  return [...ROLE_PERMISSIONS[normalizeUserRole(role)]];
}

export function getPermissionsForRoles(roles: unknown, fallbackRole?: string | null): Permission[] {
  const normalizedRoles = normalizeRoles(
    roles,
    fallbackRole ? [normalizeUserRole(fallbackRole)] : [USER_ROLES.STUDENT]
  );

  return [
    ...new Set(
      normalizedRoles.flatMap((role) =>
        isUserRole(role) ? getPermissionsForRole(role) : []
      )
    ),
  ];
}

export function roleHasPermission(role: string | undefined | null, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function hasPermission(
  user: { role?: string | null; roles?: unknown; permissions?: unknown } | undefined | null,
  permission: Permission
): boolean {
  if (!user) return false;
  return normalizePermissions(user.permissions).includes(permission) ||
    getPermissionsForRoles(user.roles, user.role).includes(permission) ||
    roleHasPermission(user.role, permission);
}

export function hasAnyPermission(
  user: { role?: string | null; roles?: unknown; permissions?: unknown } | undefined | null,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export default {
  USER_ROLES,
  ALL_USER_ROLES,
  ASSIGNABLE_USER_ROLES,
  PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  isUserRole,
  isAssignableUserRole,
  normalizeUserRole,
  isPermission,
  normalizePermissions,
  normalizeRoles,
  roleHasPermission,
  hasPermission,
  hasAnyPermission,
  getPermissionsForRole,
  getPermissionsForRoles,
};
