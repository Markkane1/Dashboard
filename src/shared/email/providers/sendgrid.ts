import type { EmailProvider, SendEmailInput, SendEmailResult } from './types';
import { parseFrom } from './types';

const FROM_RAW = process.env.EMAIL_FROM || 'EPA eLearning <no-reply@example.com>';

export class SendGridProvider implements EmailProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    // parseFrom correctly handles both "Name <addr>" and bare "addr" formats.
    // The old implementation used a fragile regex that failed for some FROM formats.
    const { name, email } = parseFrom(FROM_RAW);

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: name ? { email, name } : { email },
        subject: input.subject,
        content: [
          { type: 'text/plain', value: input.text },
          { type: 'text/html', value: input.html },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`SendGrid: HTTP ${res.status} — ${body}`);
    }

    // SendGrid returns the message ID in a response header
    const messageId = res.headers.get('x-message-id') ?? undefined;
    return { messageId, provider: 'sendgrid' };
  }
}
