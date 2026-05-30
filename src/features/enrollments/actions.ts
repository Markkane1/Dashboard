"use server";

import { auth } from "../../../auth";
import { findUserByEmail, updateUser } from "@/features/users/data/userDb";
import { fetchCourseById } from "@/infrastructure/api/courses";
import { revalidatePath } from "next/cache";
import { validateServerActionOrigin } from "@/shared/security/serverActionCsrf";

/**
 * Enroll a user in a course.
 * Verifies authentication, user validity, and that the course ID exists.
 */
export async function enrollCourse(courseId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    validateServerActionOrigin();

    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return { success: false, error: "Not authenticated" };
    }

    // Safeguard: Check if course actually exists to prevent race conditions or database corruption
    let courseExists = false;
    try {
      await fetchCourseById(courseId);
      courseExists = true;
    } catch (e) {}

    if (!courseExists) {
      return { success: false, error: "Course not found in system database" };
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return { success: false, error: "User profile not found" };
    }

    const enrolled = user.enrolledCourses || [];
    if (enrolled.includes(courseId)) {
      return { success: true, message: "Already enrolled in this course" };
    }

    const newEnrolled = [...enrolled, courseId];
    await updateUser(user.id, { enrolledCourses: newEnrolled });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error in enrollCourse server action:", error);
    return { success: false, error: "An error occurred while enrolling. Please try again." };
  }
}

/**
 * Mark a course as completed.
 * Verifies authentication, user validity, and course ID existence.
 */
export async function markComplete(courseId: string): Promise<{ success: boolean; error?: string }> {
  try {
    validateServerActionOrigin();

    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return { success: false, error: "Not authenticated" };
    }

    // Safeguard: Check if course actually exists
    let courseExists = false;
    try {
      await fetchCourseById(courseId);
      courseExists = true;
    } catch (e) {}

    if (!courseExists) {
      return { success: false, error: "Course not found in system database" };
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return { success: false, error: "User profile not found" };
    }

    const enrolled = user.enrolledCourses || [];
    const completed = user.completedCourses || [];

    // Filter course out of enrolled list
    const newEnrolled = enrolled.filter((id) => id !== courseId);
    
    // Append to completed list if not already present
    const newCompleted = completed.includes(courseId)
      ? completed
      : [...completed, courseId];

    await updateUser(user.id, {
      enrolledCourses: newEnrolled,
      completedCourses: newCompleted,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error in markComplete server action:", error);
    return { success: false, error: "An error occurred while completing course. Please try again." };
  }
}

/**
 * Unenroll a user from a course.
 * Verifies authentication, user validity, and course ID existence.
 */
export async function unenrollCourse(courseId: string): Promise<{ success: boolean; error?: string }> {
  try {
    validateServerActionOrigin();

    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return { success: false, error: "Not authenticated" };
    }

    // Safeguard: Check if course actually exists
    let courseExists = false;
    try {
      await fetchCourseById(courseId);
      courseExists = true;
    } catch (e) {}

    if (!courseExists) {
      return { success: false, error: "Course not found in system database" };
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return { success: false, error: "User profile not found" };
    }

    const enrolled = user.enrolledCourses || [];
    const newEnrolled = enrolled.filter((id) => id !== courseId);

    await updateUser(user.id, { enrolledCourses: newEnrolled });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error in unenrollCourse server action:", error);
    return { success: false, error: "An error occurred while unenrolling. Please try again." };
  }
}
