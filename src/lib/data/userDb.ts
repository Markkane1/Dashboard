import fs from "fs/promises";
import path from "path";

// Define the database file path securely relative to workspace
const DB_PATH = path.join(process.cwd(), "src", "lib", "data", "users.json");

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

// Read all users from local JSON file
export async function getUsers(): Promise<StoredUser[]> {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (error: any) {
    // If the file doesn't exist, create it as empty array and return empty list
    if (error.code === "ENOENT") {
      await fs.writeFile(DB_PATH, JSON.stringify([]), "utf-8");
      return [];
    }
    console.error("Error reading users from JSON database:", error);
    return [];
  }
}

// Find a single user by email
export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const users = await getUsers();
  const lowerEmail = email.toLowerCase().trim();
  return users.find((user) => user.email.toLowerCase() === lowerEmail) || null;
}

// Find a single user by id
export async function findUserById(id: string): Promise<StoredUser | null> {
  const users = await getUsers();
  return users.find((user) => user.id === id) || null;
}

// Save a new user record
export async function saveUser(user: StoredUser): Promise<StoredUser> {
  const users = await getUsers();
  users.push(user);
  await fs.writeFile(DB_PATH, JSON.stringify(users, null, 2), "utf-8");
  return user;
}

// Update an existing user record
export async function updateUser(id: string, updatedFields: Partial<StoredUser>): Promise<StoredUser | null> {
  const users = await getUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  
  users[index] = { ...users[index], ...updatedFields };
  await fs.writeFile(DB_PATH, JSON.stringify(users, null, 2), "utf-8");
  return users[index];
}
