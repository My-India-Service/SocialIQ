/** WhatsApp Cloud API (inbox, webhook, outbound alerts). Off unless WHATSAPP_ENABLED=true. */
export const isWhatsAppEnabled = () => process.env.WHATSAPP_ENABLED === 'true';

/** Email one-time codes for sign-up verification and code login. Off unless EMAIL_OTP_ENABLED=true. */
export const isEmailOtpEnabled = () => process.env.EMAIL_OTP_ENABLED === 'true';

/** "Continue with Google" sign-in; reuses the YouTube OAuth client. */
export const isGoogleLoginEnabled = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
