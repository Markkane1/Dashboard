"use client";

import { FormEvent, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "../auth.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      redirect: false,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <Link href="/" className={styles.brand}>ELearningEPA</Link>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Use your email and password to continue learning.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input className={styles.input} name="email" type="email" autoComplete="email" required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input className={styles.input} name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => signIn("google", { callbackUrl })}
          >
            Continue with Google
          </button>
        </form>

        <div className={styles.links}>
          <Link href="/forgot-password" className={styles.link}>Forgotten username/password?</Link>
          <Link href="/signup" className={styles.link}>Create account</Link>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
