const mongoose = require('mongoose');
const { ALL_USER_ROLES, USER_ROLES } = require('../../shared/permissions');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ALL_USER_ROLES,
      default: USER_ROLES.STUDENT
    },
    roles: {
      type: [String],
      default: [USER_ROLES.STUDENT],
      set(value: unknown) {
        if (!Array.isArray(value) || value.length === 0) {
          return [USER_ROLES.STUDENT];
        }

        return [...new Set(value.map((role) => String(role || '').trim().toLowerCase()).filter(Boolean))];
      }
    },
    permissions: {
      type: [String],
      default: []
    },
    avatar: {
      type: String,
      default: ''
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationTokenHash: {
      type: String
    },
    emailVerificationExpires: {
      type: Date
    },
    passwordResetTokenHash: {
      type: String
    },
    passwordResetExpires: {
      type: Date
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
    },
    demoKey: {
      type: String,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;

export {};
