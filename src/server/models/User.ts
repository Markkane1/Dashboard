const mongoose = require('mongoose');

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
      default: 'student'
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
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;

export {};
