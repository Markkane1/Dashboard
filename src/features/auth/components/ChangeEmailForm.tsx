"use client";

import React, { useState } from "react";
import { requestEmailChange } from "@/features/auth/actions";

interface ChangeEmailFormProps {
  currentEmail: string;
}

export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const result = await requestEmailChange({ newEmail });
    if (result.success) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(result.error || "Failed to send confirmation email. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="change-email-success" role="status">
        <p>
          <strong>Confirmation email sent to {newEmail}.</strong>
        </p>
        <p>
          Check your inbox and click the confirmation link to complete the change.
          The link expires in 24 hours.
        </p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted, #7f8c8d)" }}>
          Your current email address ({currentEmail}) will remain active until you confirm the change.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label className="form-label">Current email address</label>
        <p className="form-hint" style={{ fontWeight: 600 }}>{currentEmail}</p>
      </div>

      <div className="form-group">
        <label htmlFor="new-email" className="form-label">
          New email address
        </label>
        <input
          id="new-email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          placeholder="new@example.com"
          className="form-input"
          disabled={status === "loading"}
          autoComplete="email"
        />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={status === "loading" || !newEmail}
        style={{ width: "100%", marginTop: 8 }}
      >
        {status === "loading" ? "Sending confirmation…" : "Send confirmation email"}
      </button>
    </form>
  );
}
