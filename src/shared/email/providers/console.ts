import { logger } from '@/shared/logger';
import type { EmailProvider, SendEmailInput, SendEmailResult } from './types';

function redactSensitiveUrls(value: string | undefined) {
  return (value || '').replace(/([?&](?:token|code|resetToken|verificationToken)=)[^\s&]+/gi, '$1[REDACTED]');
}

/**
 * Console/dev provider — logs email content to pino logger instead of
 * delivering it. Used as the automatic fallback in non-production environments
 * when no external provider is configured.
 */
export class ConsoleProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    logger.info(
      {
        emailProvider: 'console',
        to: input.to,
        subject: input.subject,
        text: redactSensitiveUrls(input.text),
      },
      '[dev-email] Email would have been sent'
    );
    return { provider: 'console' };
  }
}
