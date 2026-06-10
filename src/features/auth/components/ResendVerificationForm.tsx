"use client";

import React, { useState } from "react";
import { resendVerification } from "@/features/auth/actions";

export function ResendVerificationForm({ defaultEmail }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const result = await resendVerification({ email });
    if (result.success) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(result.error || "Failed to send. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="resend-success" role="status">
        <p>
          <strong>Verification email sent.</strong> Check your inbox and spam folder.
          The link expires in 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="resend-form" noValidate>
      <label htmlFor="resend-email" className="resend-label">
        Email address
      </label>
      <input
        id="resend-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="you@example.com"
        className="resend-input"
        disabled={status === "loading"}
      />
      {error && (
        <p className="resend-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={status === "loading"}>
        {status === "loading" ? "Sending…" : "Resend verification email"}
      </button>
    </form>
  );
}
