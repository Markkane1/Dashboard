import { baseTemplate } from './base';
import type { SendEmailInput } from '../providers/types';

/**
 * Sent to the NEW email address to confirm the address change.
 * The user must click the link to complete the swap.
 */
export function buildEmailChangeEmail(
  name: string,
  newEmail: string,
  confirmUrl: string
): SendEmailInput {
  const subject = 'Confirm your new EPA eLearning email address';

  const html = baseTemplate({
    title: subject,
    preheader: `Confirm ${newEmail} as your new EPA eLearning email address.`,
    bodyHtml: `
      <p>Hi ${escName(name)},</p>
      <p>You requested to change your EPA eLearning email address to <strong>${escName(newEmail)}</strong>.</p>
      <p>Please confirm this change by clicking the button below. This link is valid for <strong>24 hours</strong>.</p>
      <p>
        <a class="btn" href="${confirmUrl}">Confirm new email address</a>
      </p>
      <p style="color:#7f8c8d;font-size:13px;">
        If you did not request this change, you can safely ignore this email.
        Your current email address will remain unchanged.
      </p>
      <p style="word-break:break-all;font-size:12px;color:#aab2bd;">
        Or copy and paste this URL: ${confirmUrl}
      </p>
    `,
    footerNote: 'You are receiving this because an email address change was requested for your EPA eLearning account.',
  });

  const text = [
    `Hi ${name},`,
    '',
    `You requested to change your EPA eLearning email address to: ${newEmail}`,
    '',
    'Please confirm this change by visiting the link below (valid for 24 hours):',
    '',
    confirmUrl,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');

  return { to: newEmail, subject, html, text };
}

function escName(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
