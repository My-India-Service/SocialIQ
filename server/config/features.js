/** WhatsApp Cloud API (inbox, webhook, outbound alerts). Off unless WHATSAPP_ENABLED=true. */
export const isWhatsAppEnabled = () => process.env.WHATSAPP_ENABLED === 'true';
