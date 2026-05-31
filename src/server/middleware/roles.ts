import type { NextFunction, Request, Response } from 'express';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const {
  PERMISSIONS,
  hasPermission,
  normalizeUserRole,
} = require('../../shared/permissions');

function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = normalizeUserRole(req.user?.role);
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
}

function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
}

module.exports = {
  requireRole,
  requireAdmin: requirePermission(PERMISSIONS.MANAGE_USERS),
  requireContentManager: requirePermission(PERMISSIONS.MANAGE_CONTENT),
  requirePermission
};

export {};
