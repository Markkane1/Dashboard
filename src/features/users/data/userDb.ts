import { signApiAccessToken } from "@/shared/auth/apiToken";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  avatar?: string;
  enrolledCourses?: string[];
  completedCourses?: string[];
  emailVerified?: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: string;
  createdAt: string;
}

const getBaseUrl = () => process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function getServerAuthHeader() {
  const token = signApiAccessToken(
    { id: "internal-service", role: "service", email: "service@internal.local" },
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
    console.error("Error fetching user by email:", error);
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
    console.error("Error fetching user by ID:", error);
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
    console.error("Error authenticating user:", error);
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
    console.error("Error updating user:", error);
    return null;
  }
}

export async function saveUser(user: StoredUser): Promise<StoredUser> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to save user. Status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error saving user:", error);
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
    console.error("Error storing password reset token:", error);
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
    console.error("Error resetting password:", error);
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
    console.error("Error verifying email:", error);
    return false;
  }
}
