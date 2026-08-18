/**
 * Meta WhatsApp Cloud API — verify webhook, parse inbound, send messages.
 * Credentials stay server-side (env). Never expose tokens to the client.
 */
import crypto from 'crypto';

function graphVersion() {
  return (process.env.META_GRAPH_API_VERSION || 'v21.0').replace(/^\//, '');
}

function phoneNumberId() {
  return (process.env.META_PHONE_NUMBER_ID || '').trim();
}

function accessToken() {
  return (process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
}

export function isWhatsAppConfigured() {
  return Boolean(
    accessToken() &&
      phoneNumberId() &&
      (process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim() &&
      (process.env.META_APP_SECRET || '').trim()
  );
}

export function getWebhookPublicUrl() {
  const base = (process.env.SERVER_URL || 'http://localhost:5001').replace(/\/$/, '');
  return `${base}/api/whatsapp/webhook`;
}

export function getWhatsAppPublicStatus() {
  const configured = isWhatsAppConfigured();
  const phoneId = phoneNumberId();
  const wabaId = (process.env.META_WABA_ID || '').trim();
  return {
    configured,
    webhookUrl: getWebhookPublicUrl(),
    phoneNumberId: phoneId || null,
    wabaId: wabaId || null,
    graphApiVersion: graphVersion(),
    accessTokenConfigured: Boolean(accessToken()),
    verifyTokenConfigured: Boolean((process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim()),
    appSecretConfigured: Boolean((process.env.META_APP_SECRET || '').trim()),
    leadTemplate: (process.env.META_WHATSAPP_LEAD_TEMPLATE || '').trim() || null,
  };
}

/**
 * Meta GET webhook verification.
 * @returns {{ ok: true, challenge: string } | { ok: false }}
 */
export function verifyWebhookChallenge({ mode, token, challenge }) {
  const expected = (process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim();
  if (mode === 'subscribe' && expected && token === expected && challenge != null) {
    return { ok: true, challenge: String(challenge) };
  }
  return { ok: false };
}

/**
 * Validate X-Hub-Signature-256 from Meta.
 * @param {Buffer|string} rawBody
 * @param {string|undefined} signatureHeader
 */
export function verifySignature(rawBody, signatureHeader) {
  const secret = (process.env.META_APP_SECRET || '').trim();
  if (!secret) return false;
  if (!signatureHeader || typeof signatureHeader !== 'string') return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractTextBody(message) {
  if (!message || typeof message !== 'object') return '';
  const type = message.type || '';
  if (type === 'text') return message.text?.body || '';
  if (type === 'button') return message.button?.text || message.button?.payload || '';
  if (type === 'interactive') {
    return (
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      ''
    );
  }
  if (type === 'image' || type === 'video' || type === 'document' || type === 'audio') {
    const caption =
      message[type]?.caption || message.image?.caption || message.video?.caption || '';
    return caption || `[${type} message]`;
  }
  return '';
}

/**
 * Normalize Cloud API webhook payload into inbound message events.
 */
export function parseInboundMessages(body) {
  const messages = [];
  const statuses = [];

  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field && change.field !== 'messages') continue;
      const value = change?.value || {};
      const phoneNumberId = value.metadata?.phone_number_id || '';
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactByWaId = new Map(
        contacts.map((c) => [c.wa_id, c.profile?.name || c.wa_id])
      );

      for (const msg of Array.isArray(value.messages) ? value.messages : []) {
        const from = msg.from || '';
        const text = extractTextBody(msg);
        messages.push({
          phoneNumberId,
          wamid: msg.id,
          from,
          author: contactByWaId.get(from) || from,
          authorHandle: from ? `+${from}` : '',
          type: msg.type || 'unknown',
          text,
          timestamp: msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000)
            : new Date(),
        });
      }

      for (const st of Array.isArray(value.statuses) ? value.statuses : []) {
        statuses.push({
          phoneNumberId,
          id: st.id,
          status: st.status,
          timestamp: st.timestamp,
          recipientId: st.recipient_id,
        });
      }
    }
  }

  return { messages, statuses };
}

export function mapWhatsAppMessageToRaw(msg) {
  return {
    externalId: msg.wamid,
    videoId: msg.phoneNumberId || '',
    postTitle: 'WhatsApp message',
    author: msg.author || msg.from || 'WhatsApp user',
    authorHandle: msg.authorHandle || (msg.from ? `+${msg.from}` : ''),
    text: msg.text,
    likes: 0,
    replies: 0,
    postedAt: msg.timestamp || new Date(),
    platform: 'whatsapp',
  };
}

function normalizeE164(to) {
  const digits = String(to || '').replace(/\D/g, '');
  return digits;
}

async function graphSend(payload) {
  const id = phoneNumberId();
  const token = accessToken();
  if (!id || !token) {
    throw new Error('WhatsApp Cloud API is not configured on the server');
  }

  const url = `https://graph.facebook.com/${graphVersion()}/${id}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      data?.error?.message || data?.message || `Graph send failed (${res.status})`;
    const err = new Error(errMsg);
    err.status = res.status;
    err.code = data?.error?.code;
    err.graph = data?.error;
    throw err;
  }
  return data;
}

/**
 * Send a free-form text message (only allowed inside the 24h customer care window).
 */
export async function sendWhatsAppMessage(to, message) {
  const recipient = normalizeE164(to);
  if (!recipient) throw new Error('WhatsApp recipient phone is required');
  const body = String(message || '').trim();
  if (!body) throw new Error('WhatsApp message text is required');

  return graphSend({
    to: recipient,
    type: 'text',
    text: { preview_url: false, body: body.slice(0, 4096) },
  });
}

/**
 * Send an approved template message (required outside the 24h window).
 */
export async function sendWhatsAppTemplate(
  to,
  templateName,
  languageCode = 'en',
  components = undefined
) {
  const recipient = normalizeE164(to);
  if (!recipient) throw new Error('WhatsApp recipient phone is required');
  const name = String(templateName || '').trim();
  if (!name) throw new Error('WhatsApp template name is required');

  const template = {
    name,
    language: { code: languageCode || 'en' },
  };
  if (Array.isArray(components) && components.length) {
    template.components = components;
  }

  return graphSend({
    to: recipient,
    type: 'template',
    template,
  });
}

/**
 * Prefer text; if Meta rejects (outside session), fall back to lead template when configured.
 */
export async function sendWhatsAppLeadAlert(to, textMessage) {
  try {
    return await sendWhatsAppMessage(to, textMessage);
  } catch (err) {
    const template = (process.env.META_WHATSAPP_LEAD_TEMPLATE || '').trim();
    if (!template) throw err;
    const lang = (process.env.META_WHATSAPP_LEAD_TEMPLATE_LANG || 'en').trim();
    return sendWhatsAppTemplate(to, template, lang, [
      {
        type: 'body',
        parameters: [{ type: 'text', text: String(textMessage || '').slice(0, 1024) }],
      },
    ]);
  }
}
