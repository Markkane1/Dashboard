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
const { getMissingPrerequisiteIds, isCoursePublishable } = require('../services/courseAccessRules');
const { writeAuditLog } = require('../services/audit');
const { markExistingEnrollmentCompleted } = require('../services/courseCompletion');
import { sendEmail } from '../../shared/email/sendEmail';
import { buildVerificationEmail } from '../../shared/email/templates/verification';
import { buildEmailChangeEmail } from '../../shared/email/templates/emailChange';
import { buildAdminResetEmail } from '../../shared/email/templates/adminReset';
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

/**
 * Serializes a user using pre-fetched user enrollment records.
 * This helper avoids N+1 query patterns during user batch listings.
 */
async function serializeUserWithEnrollments(
  user: any,
  enrollments: any[]
): Promise<SharedUser & Record<string, unknown>> {
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;
  const userId = plain._id || plain.id;
  const roles = normalizeRoles(plain.roles, [plain.role || USER_ROLES.STUDENT]);
  const directPermissions = normalizePermissions(plain.permissions);
  const rolePermissions = await resolvePermissionsForRoles(roles, plain.role);

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
    status: plain.status || 'active',
    createdAt: plain.createdAt
  };
}

/**
 * Serializes a single user by fetching their enrollment records dynamically.
 * Maintains backward compatibility for single-user endpoints.
 */
async function serializeUser(user: any): Promise<SharedUser & Record<string, unknown>> {
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;
  const userId = plain._id || plain.id;
  const enrollments = await Enrollment.find({ userId }).populate('courseId', '_id');
  return serializeUserWithEnrollments(user, enrollments);
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

    const userIds = users.map((user: any) => user._id);
    const allEnrollments = await Enrollment.find({ userId: { $in: userIds } }).populate('courseId', '_id');

    // Group enrollments by userId for O(1) matching during serialization
    const enrollmentsByUserId = new Map<string, any[]>();
    for (const enrollment of allEnrollments) {
      const uIdStr = enrollment.userId.toString();
      if (!enrollmentsByUserId.has(uIdStr)) {
        enrollmentsByUserId.set(uIdStr, []);
      }
      enrollmentsByUserId.get(uIdStr)!.push(enrollment);
    }

    const serializedUsers = await Promise.all(
      users.map((user: any) => {
        const userEnrollments = enrollmentsByUserId.get(user._id.toString()) || [];
        return serializeUserWithEnrollments(user, userEnrollments);
      })
    );

    res.setHeader('X-Total-Count', String(totalCount));
    res.setHeader('X-Page-Limit', String(limit));
    res.json(serializedUsers);
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

    if (user.status === "disabled") {
      return res.status(403).json({ error: "Your account has been disabled." });
    }

    if (user.status === "pending") {
      return res.status(403).json({ error: "Your account is pending administrator approval." });
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

    const existingUser = await User.findOne({ email }).select('_id email passwordResetExpires');
    await User.updateOne(
      { email },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: expiresAt
        }
      }
    );

    await writeAuditLog(req, {
      action: 'user.password-reset-issued',
      entityType: 'User',
      entityId: existingUser?._id || email,
      details: {
        result: 'success',
        targetEmail: email,
        oldValue: { passwordResetExpires: existingUser?.passwordResetExpires || null },
        newValue: { passwordResetIssued: true, passwordResetExpires: expiresAt }
      }
    });
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
    if (!isCoursePublishable(course)) {
      return res.status(403).json({ error: "Course is not approved for enrollment." });
    }
    const missingPrerequisiteIds = await getMissingPrerequisiteIds(userId, course);
    if (missingPrerequisiteIds.length > 0) {
      return res.status(403).json({
        error: "Complete prerequisite courses before enrollment.",
        missingPrerequisiteIds
      });
    }

    let enrollment = await Enrollment.findOne({ userId, courseId }).select('completed');
    const createdEnrollment = !enrollment;
    if (!enrollment) {
      enrollment = await Enrollment.create({ userId, courseId, completed: false });
      await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } });
    }
    if (createdEnrollment) {
      await Notification.create({
        userId,
        type: 'course',
        title: 'Course enrollment confirmed',
        message: `You enrolled in ${course.title}.`,
        linkUrl: `/courses/${course._id}`
      });
    }
    await writeAuditLog(req, {
      action: createdEnrollment ? 'enrollment.create' : 'enrollment.exists',
      entityType: 'Enrollment',
      entityId: enrollment._id,
      details: { courseId, userId, created: createdEnrollment }
    });

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
      await writeAuditLog(req, { action: 'enrollment.delete', entityType: 'Enrollment', entityId: deleted._id, details: { courseId, userId } });
    }

    const user = await User.findById(userId);
    res.json(await serializeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error unenrolling user');
    res.status(500).json({ error: "Failed to unenroll user" });
  }
});

// POST /api/users/complete
// Mark a course as completed (restricted to admins, instructors, or internal service)
router.post('/complete', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isService = req.user.id === 'internal-service';
    const isAdmin = hasPermission(req.user, PERMISSIONS.MANAGE_USERS);
    const isInstructor = req.user.role === USER_ROLES.INSTRUCTOR || req.user.roles?.includes(USER_ROLES.INSTRUCTOR);

    if (!isService && !isAdmin && !isInstructor) {
      return res.status(403).json({ error: "Access denied. Only admins or instructors can manually mark a course as complete." });
    }

    const { courseId, userId: targetUserId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "courseId is required" });
    }

    const userId = targetUserId || req.user.id;

    const [course, targetUser] = await Promise.all([
      Course.findById(courseId),
      User.findById(userId)
    ]);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Require an existing enrollment and verify completion rules before updating.
    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res.status(400).json({ error: "Enrollment is required to mark course complete." });
    }

    const completionCheck = await markExistingEnrollmentCompleted({ userId, courseId });
    if (!completionCheck.allowed) {
      return res.status(400).json({ error: completionCheck.error });
    }

    await Notification.create({
      userId,
      type: 'certificate',
      title: 'Course completed',
      message: `You completed ${course.title}. Your certificate is ready to download.`,
      linkUrl: '/dashboard'
    });

    await writeAuditLog(req, {
      action: 'enrollment.manual-complete',
      entityType: 'Enrollment',
      entityId: completionCheck.enrollment._id,
      details: {
        courseId,
        userId,
        forcedBy: req.user.id,
        forcedAt: new Date(),
        notes: 'Admin manual course completion completion'
      }
    });
    res.json(await serializeUser(targetUser));
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

    const existingUser = await User.findById(req.params.id).select('role roles permissions');
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const oldRoles = existingUser.roles || [];
    const oldRole = existingUser.role;
    const oldPermissions = normalizePermissions(existingUser.permissions);

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

    await writeAuditLog(req, {
      action: 'user.role-change',
      entityType: 'User',
      entityId: req.params.id,
      details: {
        result: 'success',
        oldValue: {
          role: oldRole,
          roles: oldRoles,
          directPermissions: oldPermissions
        },
        newValue: {
          role: legacyRole,
          roles: validRoleKeys,
          directPermissions
        }
      }
    });
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
// Create a new user (internal-service signup or admin creation)
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    if (req.user?.id !== 'internal-service' && !hasPermission(req.user, PERMISSIONS.MANAGE_USERS)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }

    const {
      name,
      email,
      password,
      avatar
    } = req.body;

    // Generate secure email verification token on backend
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const emailVerified = req.user?.id === 'internal-service' && req.body.emailVerified !== undefined
      ? req.body.emailVerified
      : false;

    const status = req.body.status !== undefined
      ? req.body.status
      : 'active';

    const userData = {
      name,
      email,
      password,
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: [],
      avatar: avatar || '',
      emailVerified,
      status,
      emailVerificationTokenHash,
      emailVerificationExpires
    };

    const user = new User(userData);
    await user.save();

    await writeAuditLog(req, { action: 'user.create', entityType: 'User', entityId: user._id, details: { email, name } });
    const serialized = await serializeUser(user);
    res.status(201).json({
      ...serialized,
      emailVerificationToken: verificationToken
    });
  } catch (error) {
    logger.error({ err: error }, 'Error creating user');
    if ((error as { code?: number }).code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

module.exports = router;

// ---------------------------------------------------------------------------
// POST /api/users/resend-verification
// Re-issue and resend an email verification token for unverified accounts.
// Rate-limited: max 3 requests per email address per hour.
// ---------------------------------------------------------------------------
const resendVerificationCount = new Map<string, { count: number; resetAt: number }>();

router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    // Rate-limit: max 3 resends per email per hour
    const now = Date.now();
    const rateKey = email;
    const entry = resendVerificationCount.get(rateKey);
    if (entry && entry.resetAt > now) {
      if (entry.count >= 3) {
        return res.status(429).json({ error: 'Too many resend requests. Please wait before trying again.' });
      }
      entry.count++;
    } else {
      resendVerificationCount.set(rateKey, { count: 1, resetAt: now + 60 * 60 * 1000 });
    }

    // Find user — always return success to avoid email enumeration
    const user = await User.findOne({ email });
    if (!user || user.emailVerified) {
      return res.json({ success: true });
    }

    // Generate a fresh token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verificationUrl = `${appUrl}/auth/verify-email?token=${verificationToken}`;
    const emailContent = buildVerificationEmail(user.name, verificationUrl);
    await sendEmail({ ...emailContent, to: email });
    await writeAuditLog(req, { action: 'email.resend-verification', entityType: 'User', entityId: user._id, details: { email } });

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error resending verification email');
    res.status(500).json({ error: 'Failed to resend verification email.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/users/email-change/request
// Authenticated user requests an email address change.
// Sends a confirmation link to the NEW address.
// ---------------------------------------------------------------------------
router.post('/email-change/request', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const newEmail = String(req.body.newEmail || '').toLowerCase().trim();
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid new email address is required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (newEmail === user.email) {
      return res.status(400).json({ error: 'New email address must be different from current address.' });
    }

    // Ensure the new address is not already taken
    const existing = await User.findOne({ email: newEmail });
    if (existing) {
      return res.status(409).json({ error: 'That email address is already in use.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.pendingEmail = newEmail;
    user.pendingEmailTokenHash = tokenHash;
    user.pendingEmailExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const confirmUrl = `${appUrl}/auth/change-email/confirm?token=${token}`;
    const emailContent = buildEmailChangeEmail(user.name, newEmail, confirmUrl);
    await sendEmail(emailContent);
    await writeAuditLog(req, { action: 'user.email-change-requested', entityType: 'User', entityId: user._id, details: { currentEmail: user.email, newEmail } });

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error requesting email change');
    res.status(500).json({ error: 'Failed to request email change.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/users/email-change/confirm
// Token-based confirmation that swaps email ← pendingEmail.
// ---------------------------------------------------------------------------
router.post('/email-change/confirm', async (req: Request, res: Response) => {
  try {
    const token = String(req.body.token || '');
    if (!token) return res.status(400).json({ error: 'Confirmation token is required.' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      pendingEmailTokenHash: tokenHash,
      pendingEmailExpires: { $gt: new Date() }
    });
    if (!user || !user.pendingEmail) {
      return res.status(400).json({ error: 'Confirmation link is invalid or expired.' });
    }

    // Check the new address is still not taken (race condition guard)
    const conflict = await User.findOne({ email: user.pendingEmail, _id: { $ne: user._id } });
    if (conflict) {
      return res.status(409).json({ error: 'That email address has since been taken. Please request a new change.' });
    }

    const oldEmail = user.email;
    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.pendingEmailTokenHash = undefined;
    user.pendingEmailExpires = undefined;
    await user.save();
    await writeAuditLog(req, { action: 'user.email-changed', entityType: 'User', entityId: user._id, details: { oldEmail, newEmail: user.email } });

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error confirming email change');
    res.status(500).json({ error: 'Failed to confirm email change.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/users/admin-password-reset
// Admin triggers a password reset email on behalf of a specific user.
// Requires MANAGE_PASSWORD_RESETS permission.
// ---------------------------------------------------------------------------
router.post('/admin-password-reset', auth, requirePermission(PERMISSIONS.MANAGE_PASSWORD_RESETS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, email: targetEmail } = req.body;
    if (!userId && !targetEmail) {
      return res.status(400).json({ error: 'Either userId or email is required.' });
    }

    const user = userId
      ? await User.findById(userId)
      : await User.findOne({ email: String(targetEmail).toLowerCase().trim() });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const oldPasswordResetExpires = user.passwordResetExpires;

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    const adminName = req.user.name || req.user.email || undefined;
    const emailContent = buildAdminResetEmail(user.name, resetUrl, adminName);
    await sendEmail({ ...emailContent, to: user.email });
    await writeAuditLog(req, {
      action: 'user.admin-password-reset-issued',
      entityType: 'User',
      entityId: user._id,
      details: {
        result: 'success',
        targetEmail: user.email,
        issuedBy: req.user.id,
        oldValue: { passwordResetExpires: oldPasswordResetExpires || null },
        newValue: { passwordResetIssued: true, passwordResetExpires: user.passwordResetExpires }
      }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error issuing admin password reset');
    res.status(500).json({ error: 'Failed to issue admin password reset.' });
  }
});

export {};
