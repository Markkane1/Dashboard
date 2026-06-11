import type { EmailProvider, SendEmailInput, SendEmailResult } from './types';
import { parseFrom } from './types';

const FROM_RAW = process.env.EMAIL_FROM || 'EPA eLearning <no-reply@example.com>';

export class ResendProvider implements EmailProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const { name, email } = parseFrom(FROM_RAW);
    const from = name ? `${name} <${email}>` : email;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend: HTTP ${res.status} — ${body}`);
    }

    const body = await res.json().catch(() => ({})) as { id?: string };
    return { messageId: body.id, provider: 'resend' };
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { status: 'unhealthy', error: `Resend API returned HTTP ${res.status}: ${body}` };
      }
      return { status: 'healthy' };
    } catch (error: unknown) {
      return { status: 'unhealthy', error: error instanceof Error ? error.message : String(error) };
    }
  }
}
