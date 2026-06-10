import { baseTemplate } from './base';
import type { SendEmailInput } from '../providers/types';

export function buildVerificationEmail(
  name: string,
  verificationUrl: string
): SendEmailInput {
  const subject = 'Verify your EPA eLearning email address';

  const html = baseTemplate({
    title: subject,
    preheader: 'Confirm your email address to activate your EPA eLearning account.',
    bodyHtml: `
      <p>Hi ${escName(name)},</p>
      <p>Thank you for registering with EPA eLearning. Please verify your email address to activate your account.</p>
      <p>
        <a class="btn" href="${verificationUrl}">Verify email address</a>
      </p>
      <p style="color:#7f8c8d;font-size:13px;">
        This link expires in <strong>24 hours</strong>.
        If you did not create an EPA eLearning account, you can safely ignore this email.
      </p>
      <p style="word-break:break-all;font-size:12px;color:#aab2bd;">
        Or copy and paste this URL: ${verificationUrl}
      </p>
    `,
    footerNote: 'You are receiving this because someone registered with this email address on EPA eLearning.',
  });

  const text = [
    `Hi ${name},`,
    '',
    'Thank you for registering with EPA eLearning.',
    'Please verify your email address to activate your account by visiting the link below:',
    '',
    verificationUrl,
    '',
    'This link expires in 24 hours.',
    'If you did not create an EPA eLearning account, you can safely ignore this email.',
  ].join('\n');

  return { to: '', subject, html, text };
}

function escName(name: string): string {
  return name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
