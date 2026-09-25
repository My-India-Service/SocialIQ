import nodemailer from 'nodemailer';

let cachedTransport;

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (!isEmailConfigured()) return null;
  if (cachedTransport) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransport;
}

export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) {
    return { delivered: false, reason: 'SMTP not configured' };
  }

  const info = await transport.sendMail({
    from: process.env.REPORT_FROM || 'SocialAiDigital <reports@voxa.app>',
    to,
    subject,
    text,
    html,
  });

  return { delivered: true, messageId: info.messageId };
}
