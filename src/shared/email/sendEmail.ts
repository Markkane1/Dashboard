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

export type { SendEmailInput, SendEmailResult };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = getProvider();
  return provider.send(input);
}
