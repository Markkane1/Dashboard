import { baseTemplate } from './base';
import type { SendEmailInput } from '../providers/types';

export function buildPasswordResetEmail(resetUrl: string): SendEmailInput {
  const subject = 'Reset your EPA eLearning password';

  const html = baseTemplate({
    title: subject,
    preheader: 'You requested a password reset for your EPA eLearning account.',
    bodyHtml: `
      <p>You requested a password reset for your EPA eLearning account.</p>
      <p>Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
      <p>
        <a class="btn" href="${resetUrl}">Reset password</a>
      </p>
      <p style="color:#7f8c8d;font-size:13px;">
        If you did not request this password reset, please ignore this email.
        Your password will not be changed.
      </p>
      <p style="word-break:break-all;font-size:12px;color:#aab2bd;">
        Or copy and paste this URL: ${resetUrl}
      </p>
    `,
    footerNote: 'You are receiving this because a password reset was requested for your EPA eLearning account.',
  });

  const text = [
    'You requested a password reset for your EPA eLearning account.',
    '',
    'Click the link below to choose a new password (valid for 1 hour):',
    '',
    resetUrl,
    '',
    'If you did not request this, please ignore this email. Your password will not be changed.',
  ].join('\n');

  return { to: '', subject, html, text };
}
