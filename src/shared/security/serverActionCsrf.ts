import "server-only";
import { headers } from "next/headers";

function getAllowedOrigin() {
  if (process.env.NEXTAUTH_URL) {
    return new URL(process.env.NEXTAUTH_URL).origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_URL is required for server action origin validation.");
  }

  return "http://localhost:3000";
}

function toOrigin(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function validateServerActionOrigin() {
  const requestHeaders = headers();
  const allowedOrigin = getAllowedOrigin();
  const origin = toOrigin(requestHeaders.get("origin"));
  const referer = toOrigin(requestHeaders.get("referer"));

  if (origin === allowedOrigin || (!origin && referer === allowedOrigin)) {
    return;
  }

  throw new Error("Invalid server action origin.");
}
