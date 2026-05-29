"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "../auth.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      role: String(formData.get("role") || "student"),
    };

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!data.success) {
      setIsSubmitting(false);
      setError(data.error || "Registration failed.");
      return;
    }

    const result = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    setIsSubmitting(false);

    if (result?.error) {
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <Link href="/" className={styles.brand}>ELearningEPA</Link>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Register as a student or instructor.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <label className={styles.field}>
            <span className={styles.label}>Full name</span>
            <input className={styles.input} name="name" autoComplete="name" required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input className={styles.input} name="email" type="email" autoComplete="email" required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input className={styles.input} name="password" type="password" autoComplete="new-password" required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Account type</span>
            <select className={styles.select} name="role" defaultValue="student">
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
          </label>
          <button className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create account"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            Continue with Google
          </button>
        </form>

        <div className={styles.links}>
          <Link href="/login" className={styles.link}>Sign in</Link>
          <Link href="/forgot-password" className={styles.link}>Recover account</Link>
        </div>
      </section>
    </main>
  );
}
