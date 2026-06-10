/**
 * Abstract Email Provider Interface
 *
 * All provider adapters implement this interface so callers are fully
 * decoupled from any specific email delivery mechanism.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  /** Full HTML body */
  html: string;
  /** Plain-text fallback body */
  text: string;
}

export interface SendEmailResult {
  /** Provider-issued message ID (for delivery tracking) */
  messageId?: string;
  /** Name of the provider that sent the message */
  provider: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

/**
 * Parse an EMAIL_FROM value of either:
 *   "Display Name <user@example.com>"
 *   "user@example.com"
 *
 * Returns separate { name, email } so each provider can format
 * the "from" field correctly.
 */
export function parseFrom(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: '', email: raw.trim() };
}
