/**
 * Shared HTML email shell used by all templates.
 * Renders a clean, accessible, government-appropriate branded email.
 */

const BRAND_COLOR = '#1a5276'; // EPA dark navy
const ACCENT_COLOR = '#2980b9';
const FONT = "'Segoe UI', Arial, sans-serif";

export interface BaseTemplateData {
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerNote?: string;
}

export function baseTemplate(data: BaseTemplateData): string {
  const preheader = data.preheader ?? data.title;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(data.title)}</title>
  <!--[if !mso]><!-->
  <style>
    body { margin: 0; padding: 0; background: #f4f6f8; font-family: ${FONT}; }
    .wrapper { width: 100%; background: #f4f6f8; padding: 32px 16px; box-sizing: border-box; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .header { background: ${BRAND_COLOR}; padding: 28px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: .3px; }
    .body { padding: 32px; color: #2c3e50; font-size: 15px; line-height: 1.65; }
    .btn { display: inline-block; margin: 24px 0 8px; padding: 13px 28px; background: ${ACCENT_COLOR}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; }
    .footer { padding: 20px 32px; background: #f4f6f8; border-top: 1px solid #e5e8ed; font-size: 12px; color: #7f8c8d; }
    .footer a { color: #7f8c8d; }
    .preheader { display: none; max-height: 0; overflow: hidden; }
  </style>
  <!--<![endif]-->
</head>
<body>
  <div class="preheader" aria-hidden="true">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>EPA eLearning</h1>
      </div>
      <div class="body">
        ${data.bodyHtml}
      </div>
      <div class="footer">
        ${data.footerNote ? `<p>${data.footerNote}</p>` : ''}
        <p>EPA eLearning Platform &mdash; This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
