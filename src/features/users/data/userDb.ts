export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  avatar?: string;
  enrolledCourses?: string[];
  completedCourses?: string[];
  createdAt: string;
}

const getBaseUrl = () => process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/email/${encodeURIComponent(email)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return null;
  }
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }
}

export async function updateUser(id: string, updatedFields: Partial<StoredUser>): Promise<StoredUser | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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
