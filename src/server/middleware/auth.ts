const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { logger } = require('../logger');
const { getPermissionsForRole, normalizePermissions, normalizeUserRole } = require('../../shared/permissions');
const Enrollment = require('../models/Enrollment');
const mongoose = require('mongoose');
import type { NextFunction, Request, Response } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

const API_TOKEN_ISSUER = 'next-auth';
const API_TOKEN_AUDIENCE = 'express-api';
const API_TOKEN_USE = 'api';

/**
 * Express Authentication Middleware.
 * Decodes the JWT from the Authorization Header (Bearer token), and sets req.user.
 */
module.exports = async function (req: Request, res: Response, next: NextFunction) {
  let token: string | null = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  try {
    const decoded = jwt.verify(token, env.AUTH_SECRET, {
      issuer: API_TOKEN_ISSUER,
      audience: API_TOKEN_AUDIENCE
    });

    const payload = decoded as JwtPayload & {
      tokenUse?: string;
      id?: string;
      email?: string;
      role?: string;
      roles?: unknown;
      permissions?: unknown;
      name?: string;
      enrolledCourses?: unknown;
      completedCourses?: unknown;
    };

    if (payload.tokenUse !== API_TOKEN_USE) {
      return res.status(401).json({ error: 'Authentication failed. Token is not an API access token.' });
    }

    const userId = String(payload.id || payload.sub || '');

    let enrolledCourses: string[] = [];
    let completedCourses: string[] = [];

    if (mongoose.Types.ObjectId.isValid(userId)) {
      const enrollments = await Enrollment.find({ userId });
      enrolledCourses = enrollments
        .map((enrollment: any) => String(enrollment.courseId))
        .filter(Boolean);
      completedCourses = enrollments
        .filter((enrollment: any) => enrollment.completed)
        .map((enrollment: any) => String(enrollment.courseId))
        .filter(Boolean);
    }

    req.user = {
      ...payload,
      id: userId,
      email: payload.email,
      role: normalizeUserRole(payload.role),
      roles: Array.isArray(payload.roles)
        ? payload.roles.map((role) => String(role))
        : [normalizeUserRole(payload.role)],
      permissions: normalizePermissions(payload.permissions).length > 0
        ? normalizePermissions(payload.permissions)
        : getPermissionsForRole(payload.role),
      enrolledCourses,
      completedCourses
    };

    next();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn({ err: error }, 'JWT authentication verification failed');
    res.status(401).json({ error: 'Authentication failed. Token is invalid or expired.' });
  }
};


export {};
