"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(formData.get("email") || "") }),
    });
    const data = await response.json();
    setIsSubmitting(false);

    if (!data.success) {
      setError(data.error || "Recovery request failed.");
      return;
    }

    setMessage(data.message);
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <Link href="/" className={styles.brand}>ELearningEPA</Link>
        <h1 className={styles.title}>Recover account</h1>
        <p className={styles.subtitle}>Enter the email address connected to your account.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {message && <div className={styles.message}>{message}</div>}
          {error && <div className={styles.error}>{error}</div>}
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input className={styles.input} name="email" type="email" autoComplete="email" required />
          </label>
          <button className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send recovery instructions"}
          </button>
        </form>

        <div className={styles.links}>
          <Link href="/login" className={styles.link}>Back to sign in</Link>
          <Link href="/signup" className={styles.link}>Create account</Link>
        </div>
      </section>
    </main>
  );
}
