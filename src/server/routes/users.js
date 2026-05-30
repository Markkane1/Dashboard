const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const auth = require('../middleware/auth');

const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);
const ACCOUNT_LOCKOUT_MS = Number(process.env.ACCOUNT_LOCKOUT_MS || 15 * 60 * 1000);

function serializeUser(user) {
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    id: String(plain._id || plain.id),
    name: plain.name,
    email: plain.email,
    role: plain.role || 'student',
    avatar: plain.avatar || '',
    enrolledCourses: plain.enrolledCourses || [],
    completedCourses: plain.completedCourses || [],
    emailVerified: plain.emailVerified === true,
    createdAt: plain.createdAt
  };
}

function isPrivileged(req) {
  return ['admin', 'service'].includes(req.user?.role);
}

function canAccessUser(req, user) {
  return isPrivileged(req) || String(user._id) === String(req.user?.id) || user.email === req.user?.email;
}

function pickAllowedUserUpdates(req) {
  const allowed = {};
  for (const key of ['name', 'avatar']) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      allowed[key] = req.body[key];
    }
  }

  if (isPrivileged(req)) {
    for (const key of ['enrolledCourses', 'completedCourses']) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        allowed[key] = req.body[key];
      }
    }
  }

  return allowed;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// GET /api/users/email/:email
// Find a user by email
router.get('/email/:email', auth, async (req, res, next) => {
  try {
    const email = req.params.email;
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(serializeUser(user));
  } catch (error) {
    console.error("Error fetching user by email:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// GET /api/users/me
// Return the authenticated user's enrollment list
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ enrolledCourses: user.enrolledCourses || [] });
  } catch (error) {
    console.error("Error fetching authenticated user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /api/users/authenticate
// Verify credentials without exposing password hashes
router.post('/authenticate', async (req, res, next) => {
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

    res.json(serializeUser(user));
  } catch (error) {
    console.error("Error authenticating user:", error);
    res.status(500).json({ error: "Failed to authenticate user" });
  }
});

// POST /api/users/verify-email
// Verify a newly registered email address using a time-limited token.
router.post('/verify-email', async (req, res, next) => {
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
    console.error("Error verifying email:", error);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// POST /api/users/password-reset/request
// Store a hashed reset token. The caller sends the email to avoid token leakage.
router.post('/password-reset/request', auth, async (req, res, next) => {
  try {
    if (!isPrivileged(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

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
    console.error("Error creating password reset token:", error);
    res.status(500).json({ error: "Failed to create password reset token" });
  }
});

// POST /api/users/password-reset/confirm
// Reset a password using a time-limited token.
router.post('/password-reset/confirm', async (req, res, next) => {
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
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// POST /api/users/enroll
// Enroll the authenticated user in a course
router.post('/enroll', auth, async (req, res, next) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "courseId is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.enrolledCourses = user.enrolledCourses || [];
    if (!user.enrolledCourses.includes(courseId)) {
      user.enrolledCourses.push(courseId);
      await user.save();
    }

    res.json({ success: true, enrolledCourses: user.enrolledCourses });
  } catch (error) {
    console.error("Error enrolling authenticated user:", error);
    res.status(500).json({ error: "Failed to enroll user" });
  }
});

// GET /api/users/:id
// Find a user by ID
router.get('/:id', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(serializeUser(user));
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// PATCH /api/users/:id/role
// Admin-only role changes
router.patch('/:id/role', auth, async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access is required" });
    }

    const { role } = req.body;
    if (!['student', 'instructor', 'admin'].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(serializeUser(updatedUser));
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

// PUT /api/users/:id
// Update a user record
router.put('/:id', auth, async (req, res, next) => {
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
    res.json(serializeUser(updatedUser));
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// POST /api/users
// Create a new user
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      avatar,
      enrolledCourses,
      completedCourses,
      emailVerified,
      emailVerificationTokenHash,
      emailVerificationExpires
    } = req.body;
    
    const userData = {
      name,
      email,
      password,
      role: 'student',
      avatar: avatar || '',
      enrolledCourses: enrolledCourses || [],
      completedCourses: completedCourses || [],
      emailVerified: emailVerified === true,
      emailVerificationTokenHash,
      emailVerificationExpires
    };
    
    const user = new User(userData);
    await user.save();
    res.status(201).json(serializeUser(user));
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

module.exports = router;
