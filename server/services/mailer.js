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
    // Hosts that block SMTP would otherwise hang requests ~2 min.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
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

  try {
    const info = await transport.sendMail({
      from: process.env.REPORT_FROM || 'SocialAiDigital <reports@socialaidigital.com>',
      to,
      subject,
      text,
      html,
    });
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`[mailer] send to ${to} failed: ${err.message}`);
    return { delivered: false, reason: err.message };
  }
}
