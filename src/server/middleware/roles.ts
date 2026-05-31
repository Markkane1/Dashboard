import type { NextFunction, Request, Response } from 'express';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role || 'student';
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
}

module.exports = {
  requireRole,
  requireAdmin: requireRole(['admin']),
  requireContentManager: requireRole(['admin', 'instructor'])
};

export {};
