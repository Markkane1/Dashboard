"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  findUserByEmail,
  resetPasswordWithToken,
  saveUser,
  storePasswordResetToken,
  StoredUser,
} from "@/features/users/data/userDb";
import { logger } from '@/shared/logger';
import { signupSchema, SignupInput } from "./validations";
import { validateServerActionOrigin } from "@/shared/security/serverActionCsrf";
import { sendEmail } from "@/shared/email/sendEmail";
import { USER_ROLES } from "@/shared/permissions";

function createToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

function getAppUrl() {
  return process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function buildUrl(path: string, token: string) {
  const url = new URL(path, getAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendVerificationEmail(email: string, name: string, token: string) {
  const verificationUrl = buildUrl("/auth/verify-email", token);
  await sendEmail({
    to: email,
    subject: "Verify your EPA Learning email",
    text: `Hi ${name}, verify your email address by opening this link: ${verificationUrl}`,
    html: `<p>Hi ${name},</p><p>Verify your email address to activate your EPA Learning account.</p><p><a href="${verificationUrl}">Verify email</a></p>`,
  });
}

async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = buildUrl("/auth/reset-password", token);
  await sendEmail({
    to: email,
    subject: "Reset your EPA Learning password",
    text: `Reset your EPA Learning password by opening this link within one hour: ${resetUrl}`,
    html: `<p>Reset your EPA Learning password by opening this link within one hour:</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}

async function verifyCaptcha(captchaToken?: string) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return process.env.NODE_ENV !== "production";
  }

  if (!captchaToken) {
    return false;
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", captchaToken);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });
  const body = await res.json().catch(() => null);
  return Boolean(body?.success);
}

export async function registerUser(input: SignupInput) {
  try {
    validateServerActionOrigin();
  } catch {
    return { success: false, error: "Invalid request origin." };
  }

  // Validate data using Zod
  const result = signupSchema.safeParse(input);
  if (!result.success) {
    const errorMap = result.error.flatten().fieldErrors;
    const firstError = Object.values(errorMap)[0]?.[0] || "Invalid input data";
    return { success: false, error: firstError };
  }

  const { name, email, password } = result.data;

  try {
    const captchaOk = await verifyCaptcha(result.data.captchaToken);
    if (!captchaOk) {
      return { success: false, error: "CAPTCHA verification failed. Please try again." };
    }

    // Check if email already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return {
        success: true,
        message: "If this email can be registered, a verification link will be sent.",
      };
    }

    // Salt and hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    const verification = createToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: USER_ROLES.STUDENT,
      avatar: "",
      enrolledCourses: [],
      emailVerified: false,
      emailVerificationTokenHash: verification.tokenHash,
      emailVerificationExpires: verificationExpires.toISOString(),
      createdAt: new Date().toISOString(),
    };

    const savedUser = await saveUser(newUser);
    await sendVerificationEmail(savedUser.email, savedUser.name, verification.token);

    return {
      success: true,
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
      },
      message: "Account created. Check your email to verify your account before signing in.",
    };
  } catch (error) {
    logger.error("Error in registerUser server action:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function requestPasswordReset(input: { email: string }) {
  try {
    validateServerActionOrigin();
  } catch {
    return { success: false, error: "Invalid request origin." };
  }

  const email = String(input.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  try {
    const user = await findUserByEmail(email);
    if (user) {
      const reset = createToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const stored = await storePasswordResetToken({
        email,
        tokenHash: reset.tokenHash,
        expiresAt,
      });
      if (stored) {
        await sendPasswordResetEmail(email, reset.token);
      }
    }

    return { success: true };
  } catch (error) {
    logger.error("Error in requestPasswordReset server action:", error);
    return { success: false, error: "Unable to start password reset. Please try again." };
  }
}

export async function resetPassword(input: {
  token: string;
  password: string;
  confirmPassword: string;
}) {
  try {
    validateServerActionOrigin();
  } catch {
    return { success: false, error: "Invalid request origin." };
  }

  if (!input.token) {
    return { success: false, error: "Reset token is missing." };
  }
  if (input.password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }
  if (input.password !== input.confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }

  const success = await resetPasswordWithToken(input.token, input.password);
  if (!success) {
    return { success: false, error: "Reset link is invalid or expired." };
  }

  return { success: true };
}

export async function enrollInCourse(courseId: string) {
  try {
    validateServerActionOrigin();
  } catch {
    return { success: false, error: "Invalid request origin." };
  }

  // Import dynamically inside server action to avoid circular dependencies
  const { auth } = await import("../../../auth");
  const { enrollInCourseApi, findUserByEmail } = await import("@/features/users/data/userDb");

  try {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return { success: false, error: "You must be logged in to enroll in a course." };
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return { success: false, error: "User not found." };
    }

    const enrolled = user.enrolledCourses || [];
    const alreadyEnrolled = enrolled.includes(courseId);
    const enrolledOnBackend = await enrollInCourseApi(user.id, user.email, courseId);
    if (!enrolledOnBackend) {
      return { success: false, error: "Enrollment request failed on backend" };
    }

    return { success: true, enrolled: !alreadyEnrolled, alreadyEnrolled };
  } catch (error) {
    logger.error("Error in enrollInCourse server action:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
