/**
 * sendEmail — public API for sending transactional emails.
 *
 * This module is a thin wrapper that delegates to the configured
 * EmailProvider (Resend, SendGrid, SMTP, or Console).
 *
 * All call sites across the app continue to use this function unchanged.
 * Provider selection is controlled by the EMAIL_PROVIDER environment variable.
 *
 * @see src/shared/email/getProvider.ts for provider factory + configuration
 * @see src/shared/email/providers/ for individual adapter implementations
 */

import { getProvider } from './getProvider';
import type { SendEmailInput, SendEmailResult } from './providers/types';
import { logger } from '@/shared/logger';

export type { SendEmailInput, SendEmailResult };

type SanitizedValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Error
  | SanitizedValue[]
  | { [key: string]: SanitizedValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getErrorProperty(error: Error, key: string): unknown {
  return (error as unknown as Record<string, unknown>)[key];
}

function setErrorProperty(error: Error, key: string, value: SanitizedValue): void {
  (error as unknown as Record<string, SanitizedValue>)[key] = value;
}

export function sanitizeError(err: unknown): SanitizedValue {
  if (err === null || err === undefined) return err;

  // Secrets to redact
  const secrets = [
    process.env.RESEND_API_KEY,
    process.env.SENDGRID_API_KEY,
    process.env.SMTP_PASS,
    process.env.SMTP_USER,
    process.env.AUTH_SECRET,
  ].filter(Boolean) as string[];

  const redactSecrets = (str: string): string => {
    let sanitized = str;
    for (const secret of secrets) {
      if (secret.length > 3) {
        sanitized = sanitized.split(secret).join('[REDACTED]');
      }
    }
    // Redact tokens/secrets from URLs
    sanitized = sanitized.replace(/([?&](?:token|code|resetToken|verificationToken|pendingEmailTokenHash|passwordResetTokenHash)=)[a-f0-9]+/gi, '$1[REDACTED]');
    // Redact bearer tokens
    sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
    return sanitized;
  };

  const sanitizePrimitive = (value: unknown): SanitizedValue => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redactSecrets(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return String(value);
  };

  const sanitizeObject = (obj: unknown, seen = new WeakSet<object>()): SanitizedValue => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return sanitizePrimitive(obj);
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);

    if (obj instanceof Error) {
      const sanitizedErr = new Error(redactSecrets(obj.message));
      sanitizedErr.name = obj.name;
      if (obj.stack) {
        sanitizedErr.stack = redactSecrets(obj.stack);
      }
      // Copy other properties
      for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('pass') ||
          lowerKey.includes('key') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('auth') ||
          lowerKey.includes('token')
        ) {
          setErrorProperty(sanitizedErr, key, '[REDACTED]');
        } else {
          setErrorProperty(sanitizedErr, key, sanitizeObject(getErrorProperty(obj, key), seen));
        }
      }
      return sanitizedErr;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item, seen));
    }

    const sanitizedObj: Record<string, SanitizedValue> = {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('pass') ||
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('token')
      ) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeObject(isRecord(obj) ? obj[key] : undefined, seen);
      }
    }
    return sanitizedObj;
  };

  return sanitizeObject(err);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const provider = getProvider();
    return await provider.send(input);
  } catch (err) {
    const sanitized = sanitizeError(err);
    logger.error({ err: sanitized }, 'Email sending failed');
    throw sanitized;
  }
}
