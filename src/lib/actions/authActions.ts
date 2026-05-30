"use server";

import bcrypt from "bcryptjs";
import { findUserByEmail, saveUser, StoredUser } from "@/lib/data/userDb";
import { signupSchema, SignupInput } from "@/lib/validations/auth";

export async function registerUser(input: SignupInput) {
  // Validate data using Zod
  const result = signupSchema.safeParse(input);
  if (!result.success) {
    const errorMap = result.error.flatten().fieldErrors;
    const firstError = Object.values(errorMap)[0]?.[0] || "Invalid input data";
    return { success: false, error: firstError };
  }

  const { name, email, password } = result.data;

  try {
    // Check if email already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return { success: false, error: "An account with this email already exists." };
    }

    // Salt and hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "student",
      avatar: "",
      enrolledCourses: [],
      createdAt: new Date().toISOString(),
    };

    // Save to local users.json
    await saveUser(newUser);

    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  } catch (error) {
    console.error("Error in registerUser server action:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function enrollInCourse(courseId: string) {
  // Import dynamically inside server action to avoid circular dependencies
  const { auth } = await import("../../../auth");
  const { updateUser, findUserByEmail } = await import("@/lib/data/userDb");

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
    if (enrolled.includes(courseId)) {
      return { success: true, alreadyEnrolled: true };
    }

    const newEnrolled = [...enrolled, courseId];
    await updateUser(user.id, { enrolledCourses: newEnrolled });

    return { success: true, enrolled: true };
  } catch (error) {
    console.error("Error in enrollInCourse server action:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
