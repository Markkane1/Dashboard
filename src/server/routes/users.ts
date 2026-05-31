const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Role = require('../models/Role');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { requireAdmin, requirePermission } = require('../middleware/roles');
const { logger } = require('../logger');
const {
  isAssignableUserRole,
  hasPermission,
  PERMISSIONS,
  USER_ROLES,
  normalizePermissions,
  normalizeRoles,
  getPermissionsForRoles,
} = require('../../shared/permissions');
import type { Request, Response } from 'express';
import type { User as SharedUser } from '../../shared/types';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);
const ACCOUNT_LOCKOUT_MS = Number(process.env.ACCOUNT_LOCKOUT_MS || 15 * 60 * 1000);

async function serializeUser(user: any): Promise<SharedUser & Record<string, unknown>> {
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;
  const userId = plain._id || plain.id;
  const roles = normalizeRoles(plain.roles, [plain.role || USER_ROLES.STUDENT]);
  const directPermissions = normalizePermissions(plain.permissions);
  const rolePermissions = await resolvePermissionsForRoles(roles, plain.role);
  
  const enrollments = await Enrollment.find({ userId }).populate('courseId', '_id');
  const enrolledCourses = enrollments
    .map((enrollment: any) => getPopulatedCourseId(enrollment))
    .filter(Boolean);
  const completedCourses = enrollments
    .filter((enrollment: any) => enrollment.completed)
    .map((enrollment: any) => getPopulatedCourseId(enrollment))
    .filter(Boolean);

  return {
    id: String(userId),
    name: plain.name,
    email: plain.email,
    role: plain.role || USER_ROLES.STUDENT,
    roles,
    permissions: [...new Set([...rolePermissions, ...directPermissions])],
    directPermissions,
    avatar: plain.avatar || '',
    enrolledCourses,
    completedCourses,
    emailVerified: plain.emailVerified === true,
    createdAt: plain.createdAt
  };
}

async function resolvePermissionsForRoles(roles: string[], fallbackRole?: string) {
  await Role.ensureDefaultRoles();
  const roleDocs = await Role.find({ key: { $in: roles }, active: true }).select('key permissions');
  const dynamicPermissions = roleDocs.flatMap((role: any) => normalizePermissions(role.permissions));
  const fallbackPermissions = getPermissionsForRoles(roles, fallbackRole);

  return [...new Set([...fallbackPermissions, ...dynamicPermissions])];
}

function getPopulatedCourseId(enrollment: any): string | null {
  if (!enrollment.courseId) {
    return null;
  }

  return String(enrollment.courseId._id || enrollment.courseId);
}

function isPrivileged(req: Request): boolean {
  return hasPermission(req.user, PERMISSIONS.READ_USERS) || hasPermission(req.user, PERMISSIONS.MANAGE_USERS);
}

function canAccessUser(req: AuthenticatedRequest, user: any): boolean {
  return isPrivileged(req) || String(user._id) === String(req.user?.id) || user.email === req.user?.email;
}

function pickAllowedUserUpdates(req: Request): Record<string, unknown> {
  const allowed: Record<string, unknown> = {};
  for (const key of ['name', 'avatar']) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      allowed[key] = req.body[key];
    }
  }

  return allowed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashToken(token: unknown): string {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function getListLimit(value: unknown) {
  const limit = Number(value || 25);
  if (!Number.isFinite(limit)) {
    return 25;
  }

  return Math.min(Math.max(Math.floor(limit), 1), 100);
}

// GET /api/users/email/:email
// Find a user by email
router.get('/email/:email', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = String(req.params.email);
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await serializeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching user by email');
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// GET /api/users/me
// Return the authenticated user's enrollment list
router.get('/me', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user.id }).populate('courseId', '_id');
    res.json({
      enrolledCourses: enrollments
        .map((enrollment: any) => getPopulatedCourseId(enrollment))
        .filter(Boolean)
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching authenticated user');
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// GET /api/users
// Admin user listing for account management.
router.get('/', auth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(Math.floor(Number(req.query.page || 1)), 1);
    const limit = getListLimit(req.query.limit);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = q
      ? {
          $or: [
            { name: { $regex: escapeRegExp(q), $options: 'i' } },
            { email: { $regex: escapeRegExp(q), $options: 'i' } }
          ]
        }
      : {};

    const [totalCount, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('name email role roles permissions avatar emailVerified createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ]);

    res.setHeader('X-Total-Count', String(totalCount));
    res.setHeader('X-Page-Limit', String(limit));
    res.json(await Promise.all(users.map((user: any) => serializeUser(user))));
  } catch (error) {
    logger.error({ err: error }, 'Error listing users');
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// POST /api/users/authenticate
// Verify credentials without exposing password hashes
router.post('/authenticate', async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      return res.status(423).json({ error: "Account is temporarily locked. Please try again later." });
    }

    if (user.emailVerified !== true) {
      return res.status(403).json({ error: "Please verify your email address before signing in." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_MS);
      }
      await user.save();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json(await serializeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error authenticating user');
    res.status(500).json({ error: "Failed to authenticate user" });
  }
});

// POST /api/users/verify-email
// Verify a newly registered email address using a time-limited token.
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const token = String(req.body.token || '');
    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    const user = await User.findOne({
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpires: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ error: "Verification link is invalid or expired" });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error verifying email');
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// POST /api/users/password-reset/request
// Store a hashed reset token. The caller sends the email to avoid token leakage.
router.post('/password-reset/request', auth, requirePermission(PERMISSIONS.MANAGE_PASSWORD_RESETS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const tokenHash = String(req.body.tokenHash || '');
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (!email || !tokenHash || !expiresAt || Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ error: "email, tokenHash, and expiresAt are required" });
    }

    await User.updateOne(
      { email },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: expiresAt
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error creating password reset token');
    res.status(500).json({ error: "Failed to create password reset token" });
  }
});

// POST /api/users/password-reset/confirm
// Reset a password using a time-limited token.
router.post('/password-reset/confirm', async (req: Request, res: Response) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!token || password.length < 8) {
      return res.status(400).json({ error: "A valid token and password are required" });
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashToken(token),
      passwordResetExpires: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    user.password = await bcrypt.hash(password, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error resetting password');
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// POST /api/users/enroll
// Enroll the authenticated user in a course
router.post('/enroll', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "courseId is required" });
    }

    const userId = req.user.id;

    // 1. Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const existingEnrollment = await Enrollment.findOne({ userId, courseId }).select('completed');
    const result = await Enrollment.findOneAndUpdate(
      { userId, courseId },
      { $setOnInsert: { userId, courseId, completed: false } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        includeResultMetadata: true
      }
    );

    if (!result.lastErrorObject?.updatedExisting) {
      await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } });
    }
    if (!existingEnrollment) {
      await Notification.create({
        userId,
        type: 'course',
        title: 'Course enrollment confirmed',
        message: `You enrolled in ${course.title}.`,
        linkUrl: `/courses/${course._id}`
      });
    }

    const user = await User.findById(userId);
    res.json(await serializeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error enrolling authenticated user');
    res.status(500).json({ error: "Failed to enroll user" });
  }
});

// POST /api/users/unenroll
// Unenroll the authenticated user from a course
router.post('/unenroll', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "courseId is required" });
    }

    const userId = req.user.id;

    // Find and delete the enrollment record
    const deleted = await Enrollment.findOneAndDelete({ userId, courseId });
    if (deleted) {
      await Course.updateOne(
        { _id: courseId, enrolledCount: { $gt: 0 } },
        { $inc: { enrolledCount: -1 } }
      );
    }

    const user = await User.findById(userId);
    res.json(await serializeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error unenrolling user');
    res.status(500).json({ error: "Failed to unenroll user" });
  }
});

// POST /api/users/complete
// Mark a course as completed for the authenticated user
router.post('/complete', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "courseId is required" });
    }

    const userId = req.user.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const result = await Enrollment.findOneAndUpdate(
      { userId, courseId },
      {
        $set: { completed: true, completedAt: new Date() },
        $setOnInsert: { userId, courseId }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        includeResultMetadata: true
      }
    );

    if (!result.lastErrorObject?.updatedExisting) {
      await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } });
    }

    await Notification.create({
      userId,
      type: 'certificate',
      title: 'Course completed',
      message: `You completed ${course.title}. Your certificate is ready to download.`,
      linkUrl: '/dashboard'
    });

    const user = await User.findById(userId);
    res.json(await serializeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error marking course as complete');
    res.status(500).json({ error: "Failed to mark course complete" });
  }
});

// GET /api/users/:id
// Find a user by ID
router.get('/:id', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await serializeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching user by ID');
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// PATCH /api/users/:id/role
// Admin-only role and direct permission changes
router.patch('/:id/role', auth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedRoles = Array.isArray(req.body.roles)
      ? req.body.roles.map((role: unknown) => String(role || '').trim().toLowerCase()).filter(Boolean)
      : req.body.role
        ? [String(req.body.role).trim().toLowerCase()]
        : [];

    if (requestedRoles.length === 0) {
      return res.status(400).json({ error: "At least one role is required" });
    }

    await Role.ensureDefaultRoles();
    const matchingRoles = await Role.find({ key: { $in: requestedRoles }, active: true }).select('key');
    const validRoleKeys = matchingRoles.map((role: any) => role.key);
    const unknownRoles = requestedRoles.filter((role: string) => !validRoleKeys.includes(role));
    if (unknownRoles.length > 0) {
      return res.status(400).json({ error: `Invalid role: ${unknownRoles[0]}` });
    }

    const directPermissions = normalizePermissions(req.body.permissions);
    if (Array.isArray(req.body.permissions) && directPermissions.length !== req.body.permissions.length) {
      return res.status(400).json({ error: "One or more permissions are invalid" });
    }
    const legacyRole = validRoleKeys.find(isAssignableUserRole) || USER_ROLES.STUDENT;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          role: legacyRole,
          roles: validRoleKeys,
          permissions: directPermissions,
        }
      },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(await serializeUser(updatedUser));
  } catch (error) {
    logger.error({ err: error }, 'Error updating user roles');
    res.status(500).json({ error: "Failed to update user roles" });
  }
});

// PUT /api/users/:id
// Update a user record
router.put('/:id', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!canAccessUser(req, targetUser)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updates = pickAllowedUserUpdates(req);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No allowed user fields provided" });
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(await serializeUser(updatedUser));
  } catch (error) {
    logger.error({ err: error }, 'Error updating user');
    res.status(500).json({ error: "Failed to update user" });
  }
});

// POST /api/users
// Create a new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      avatar,
      emailVerified,
      emailVerificationTokenHash,
      emailVerificationExpires
    } = req.body;
    
    const userData = {
      name,
      email,
      password,
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: [],
      avatar: avatar || '',
      emailVerified: emailVerified === true,
      emailVerificationTokenHash,
      emailVerificationExpires
    };
    
    const user = new User(userData);
    await user.save();
    res.status(201).json(await serializeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error creating user');
    if ((error as { code?: number }).code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

module.exports = router;

export {};
