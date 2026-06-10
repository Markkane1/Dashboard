import { signApiAccessToken } from "@/shared/auth/apiToken";
import { logger } from '@/shared/logger';
import { USER_ROLES, type Permission, type UserRole } from "@/shared/permissions";
export { checkCourseAccess } from "./courseAccess";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  roles?: string[];
  permissions?: Permission[];
  avatar?: string;
  enrolledCourses?: string[];
  completedCourses?: string[];
  emailVerified?: boolean;
  status?: "active" | "pending" | "disabled";
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: string;
  emailVerificationToken?: string;
  createdAt: string;
}

const getBaseUrl = () => process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function getServerAuthHeader() {
  const token = signApiAccessToken(
    { id: "internal-service", role: USER_ROLES.SERVICE, email: "service@internal.local" },
    "5m"
  );
  return { "Authorization": `Bearer ${token}` };
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/email/${encodeURIComponent(email)}`, {
      cache: "no-store",
      headers: await getServerAuthHeader(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.error("Error fetching user by email:", error);
    return null;
  }
}
export async function findUserById(id: string): Promise<StoredUser | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: await getServerAuthHeader(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.error("Error fetching user by ID:", error);
    return null;
  }
}

export async function authenticateUser(email: string, password: string): Promise<StoredUser | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.error("Error authenticating user:", error);
    return null;
  }
}

export async function updateUser(id: string, updatedFields: Partial<StoredUser>): Promise<StoredUser | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await getServerAuthHeader()) },
      body: JSON.stringify(updatedFields),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.error("Error updating user:", error);
    return null;
  }
}

export async function saveUser(user: StoredUser): Promise<StoredUser & { emailVerificationToken?: string }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getServerAuthHeader()),
      },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to save user. Status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    logger.error("Error saving user:", error);
    throw error;
  }
}

export async function storePasswordResetToken(input: {
  email: string;
  tokenHash: string;
  expiresAt: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getServerAuthHeader()) },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch (error) {
    logger.error("Error storing password reset token:", error);
    return false;
  }
}

export async function resetPasswordWithToken(token: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    return res.ok;
  } catch (error) {
    logger.error("Error resetting password:", error);
    return false;
  }
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    return res.ok;
  } catch (error) {
    logger.error("Error verifying email:", error);
    return false;
  }
}

async function getStudentAuthHeader(userId: string, email: string) {
  const token = signApiAccessToken(
    { id: userId, email, role: USER_ROLES.STUDENT },
    "5m"
  );
  return { "Authorization": `Bearer ${token}` };
}

export async function enrollInCourseApi(userId: string, email: string, courseId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getStudentAuthHeader(userId, email)) },
      body: JSON.stringify({ courseId }),
    });
    return res.ok;
  } catch (error) {
    logger.error("Error in enrollInCourseApi:", error);
    return false;
  }
}

export async function unenrollFromCourseApi(userId: string, email: string, courseId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/unenroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getStudentAuthHeader(userId, email)) },
      body: JSON.stringify({ courseId }),
    });
    return res.ok;
  } catch (error) {
    logger.error('Error in unenrollFromCourseApi:', error);
    return false;
  }
}

export async function resendVerificationEmail(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.ok;
  } catch (error) {
    logger.error('Error in resendVerificationEmail:', error);
    return false;
  }
}

export async function requestEmailChange(userId: string, email: string, newEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/email-change/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getStudentAuthHeader(userId, email)) },
      body: JSON.stringify({ newEmail }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({})) as { error?: string };
    return { ok: false, error: data.error || 'Request failed.' };
  } catch (error) {
    logger.error('Error in requestEmailChange:', error);
    return { ok: false, error: 'Network error.' };
  }
}

export async function confirmEmailChange(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/email-change/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch (error) {
    logger.error('Error in confirmEmailChange:', error);
    return false;
  }
}

export async function adminPasswordReset(
  targetUserId?: string,
  targetEmail?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/admin-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getServerAuthHeader()) },
      body: JSON.stringify({ userId: targetUserId, email: targetEmail }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({})) as { error?: string };
    return { ok: false, error: data.error || 'Request failed.' };
  } catch (error) {
    logger.error('Error in adminPasswordReset:', error);
    return { ok: false, error: 'Network error.' };
  }
}
