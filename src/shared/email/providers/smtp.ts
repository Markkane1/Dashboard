import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailProvider, SendEmailInput, SendEmailResult } from './types';
import { parseFrom } from './types';

const FROM_RAW = process.env.EMAIL_FROM || 'EPA eLearning <no-reply@example.com>';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

function buildConfig(): SmtpConfig {
  return {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
}

export class SmtpProvider implements EmailProvider {
  private transporter: Transporter;
  private readonly from: string;

  constructor(config?: SmtpConfig) {
    const cfg = config ?? buildConfig();
    const { name, email } = parseFrom(FROM_RAW);
    this.from = name ? `"${name}" <${email}>` : email;

    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      ...(cfg.user && cfg.pass
        ? { auth: { user: cfg.user, pass: cfg.pass } }
        : {}),
    });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return { messageId: info.messageId, provider: 'smtp' };
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      await this.transporter.verify();
      return { status: 'healthy' };
    } catch (error: unknown) {
      return { status: 'unhealthy', error: error instanceof Error ? error.message : String(error) };
    }
  }
}
