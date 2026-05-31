interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

import { logger } from '@/shared/logger';

const fromEmail = process.env.EMAIL_FROM || "EPA Learning <no-reply@example.com>";

async function sendWithResend(input: SendEmailInput) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend email failed with status ${res.status}`);
  }
}

async function sendWithSendGrid(input: SendEmailInput) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: fromEmail.replace(/^.*<|>$/g, "") },
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`SendGrid email failed with status ${res.status}`);
  }
}

export async function sendEmail(input: SendEmailInput) {
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(input);
    return;
  }

  if (process.env.SENDGRID_API_KEY) {
    await sendWithSendGrid(input);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY.");
  }

  logger.info("[dev-email]", {
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
