/**
 * Email Provider Factory
 *
 * Reads EMAIL_PROVIDER env var and returns a singleton provider instance.
 * Supported values: 'resend' | 'sendgrid' | 'smtp' | 'console'
 *
 * If EMAIL_PROVIDER is not set, auto-detection order is:
 *   resend → sendgrid → smtp (if SMTP_HOST set) → console
 *
 * The singleton is cached for the lifetime of the process so transport
 * connections (SMTP) are reused across requests.
 */

import { ResendProvider } from './providers/resend';
import { SendGridProvider } from './providers/sendgrid';
import { SmtpProvider } from './providers/smtp';
import { ConsoleProvider } from './providers/console';
import type { EmailProvider } from './providers/types';
import { logger } from '@/shared/logger';

let _provider: EmailProvider | null = null;

function createProvider(): EmailProvider {
  const explicit = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();

  if (explicit === 'resend') {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('EMAIL_PROVIDER=resend but RESEND_API_KEY is not set');
    logger.info('Email provider: Resend');
    return new ResendProvider(key);
  }

  if (explicit === 'sendgrid') {
    const key = process.env.SENDGRID_API_KEY;
    if (!key) throw new Error('EMAIL_PROVIDER=sendgrid but SENDGRID_API_KEY is not set');
    logger.info('Email provider: SendGrid');
    return new SendGridProvider(key);
  }

  if (explicit === 'smtp') {
    logger.info('Email provider: SMTP');
    return new SmtpProvider();
  }

  if (explicit === 'console') {
    logger.info('Email provider: Console (dev)');
    return new ConsoleProvider();
  }

  // Auto-detect
  if (process.env.RESEND_API_KEY) {
    logger.info('Email provider: Resend (auto-detected)');
    return new ResendProvider(process.env.RESEND_API_KEY);
  }

  if (process.env.SENDGRID_API_KEY) {
    logger.info('Email provider: SendGrid (auto-detected)');
    return new SendGridProvider(process.env.SENDGRID_API_KEY);
  }

  if (process.env.SMTP_HOST) {
    logger.info('Email provider: SMTP (auto-detected)');
    return new SmtpProvider();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'No email provider configured for production. ' +
      'Set EMAIL_PROVIDER (resend|sendgrid|smtp|console) and matching credentials.'
    );
  }

  logger.warn('Email provider: Console (no credentials found — emails will be logged only)');
  return new ConsoleProvider();
}

/**
 * Returns the singleton email provider. Call this once per request; the
 * provider instance itself is cached at module level.
 */
export function getProvider(): EmailProvider {
  if (!_provider) {
    _provider = createProvider();
  }
  return _provider;
}

/**
 * Reset the cached provider — used in tests to force re-initialization
 * with different env vars.
 */
export function resetProviderCache(): void {
  _provider = null;
}
