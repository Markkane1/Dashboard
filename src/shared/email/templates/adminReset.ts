import { baseTemplate } from './base';
import type { SendEmailInput } from '../providers/types';

/**
 * Sent when an admin triggers a password reset on behalf of a user.
 * The email makes clear this was admin-initiated so the user is not confused.
 */
export function buildAdminResetEmail(
  name: string,
  resetUrl: string,
  adminName?: string
): SendEmailInput {
  const subject = 'Your EPA eLearning password has been reset by an administrator';
  const initiator = adminName ? `an administrator (${adminName})` : 'an administrator';

  const html = baseTemplate({
    title: subject,
    preheader: 'An administrator has initiated a password reset for your account.',
    bodyHtml: `
      <p>Hi ${escName(name)},</p>
      <p>${escName(initiator)} has initiated a password reset for your EPA eLearning account.</p>
      <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
      <p>
        <a class="btn" href="${resetUrl}">Set new password</a>
      </p>
      <p style="color:#c0392b;font-size:13px;">
        <strong>If you did not expect this action</strong>, please contact your EPA eLearning administrator
        immediately and do not click the link above.
      </p>
      <p style="word-break:break-all;font-size:12px;color:#aab2bd;">
        Or copy and paste this URL: ${resetUrl}
      </p>
    `,
    footerNote: 'This action was performed by an EPA eLearning platform administrator.',
  });

  const text = [
    `Hi ${name},`,
    '',
    `${initiator} has initiated a password reset for your EPA eLearning account.`,
    '',
    'Set your new password by visiting the link below (valid for 1 hour):',
    '',
    resetUrl,
    '',
    'If you did not expect this action, please contact your EPA eLearning administrator immediately.',
  ].join('\n');

  return { to: '', subject, html, text };
}

function escName(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
