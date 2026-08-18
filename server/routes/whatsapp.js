import express from 'express';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { ingestRawComments } from '../services/sync.js';
import {
  getWhatsAppPublicStatus,
  isWhatsAppConfigured,
  mapWhatsAppMessageToRaw,
  parseInboundMessages,
  sendWhatsAppLeadAlert,
  verifySignature,
  verifyWebhookChallenge,
} from '../services/whatsapp.js';

const router = express.Router();

function envPhoneNumberId() {
  return (process.env.META_PHONE_NUMBER_ID || '').trim();
}

/** Meta webhook verification (Callback URL setup). */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = verifyWebhookChallenge({ mode, token, challenge });
  if (result.ok) {
    return res.status(200).send(result.challenge);
  }
  return res.sendStatus(403);
});

/**
 * Meta WhatsApp Cloud API events.
 * Always return 200 quickly after accepting a valid signature so Meta does not retry.
 */
router.post('/webhook', async (req, res) => {
  const signature = req.get('x-hub-signature-256');
  const rawBody = req.rawBody;
  if (!rawBody || !verifySignature(rawBody, signature)) {
    return res.sendStatus(403);
  }

  res.status(200).json({ ok: true });

  try {
    const { messages } = parseInboundMessages(req.body || {});
    const withText = messages.filter((m) => m.text?.trim() && m.wamid);

    if (!withText.length) return;

    const byPhone = new Map();
    for (const msg of withText) {
      const key = msg.phoneNumberId || envPhoneNumberId();
      if (!byPhone.has(key)) byPhone.set(key, []);
      byPhone.get(key).push(msg);
    }

    for (const [phoneId, batch] of byPhone) {
      const connections = await Connection.find({
        platform: 'whatsapp',
        status: 'connected',
        channelId: phoneId,
      });

      if (!connections.length) {
        console.warn(
          `[whatsapp] No Connection for phone_number_id=${phoneId}; enable WhatsApp inbox in Settings`
        );
        continue;
      }

      const raw = batch.map(mapWhatsAppMessageToRaw);

      for (const conn of connections) {
        const user = await User.findById(conn.user);
        if (!user) continue;
        try {
          await ingestRawComments(conn.user, 'whatsapp', raw, user);
          conn.lastSyncedAt = new Date();
          await conn.save();
        } catch (err) {
          console.error('[whatsapp] ingest failed:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp] webhook handler error:', err.message);
  }
});

router.get('/status', authRequired, async (req, res) => {
  try {
    const status = getWhatsAppPublicStatus();
    const phoneId = envPhoneNumberId();
    const connection = await Connection.findOne({
      user: req.userId,
      platform: 'whatsapp',
    });

    res.json({
      ...status,
      inboxEnabled: Boolean(
        connection && connection.status === 'connected' && connection.channelId === phoneId
      ),
      connection: connection
        ? {
            accountName: connection.accountName,
            channelId: connection.channelId,
            status: connection.status,
            lastSyncedAt: connection.lastSyncedAt,
            connectedAt: connection.connectedAt,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/enable', authRequired, async (req, res) => {
  try {
    if (!isWhatsAppConfigured()) {
      return res.status(400).json({
        message:
          'WhatsApp Cloud API is not configured on the server. Set META_WHATSAPP_* env vars and redeploy.',
      });
    }

    const phoneId = envPhoneNumberId();
    const connection = await Connection.findOneAndUpdate(
      { user: req.userId, platform: 'whatsapp' },
      {
        accountName: `WhatsApp ${phoneId}`,
        channelId: phoneId,
        status: 'connected',
        connectedAt: new Date(),
        accessToken: '',
        refreshToken: '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      message: 'WhatsApp inbox enabled for this account',
      connection: {
        accountName: connection.accountName,
        channelId: connection.channelId,
        status: connection.status,
        connectedAt: connection.connectedAt,
      },
      status: getWhatsAppPublicStatus(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/test-send', authRequired, async (req, res) => {
  try {
    if (!isWhatsAppConfigured()) {
      return res.status(400).json({ message: 'WhatsApp Cloud API is not configured on the server' });
    }

    const user = await User.findById(req.userId);
    const to =
      (req.body?.to && String(req.body.to).trim()) ||
      user?.integrations?.whatsappNotifyPhone ||
      '';

    if (!to) {
      return res.status(400).json({
        message: 'Set a sales notify phone in Settings, or pass { to: "+91…" }',
      });
    }

    const text =
      (req.body?.message && String(req.body.message).trim()) ||
      `Voxa WhatsApp test from ${user?.brandName || 'Voxa'} — Cloud API OK.`;

    const data = await sendWhatsAppLeadAlert(to, text);
    res.json({ ok: true, message: 'Test message sent', graph: data });
  } catch (err) {
    res.status(err.status && err.status < 500 ? err.status : 502).json({
      message: err.message,
      code: err.code,
    });
  }
});

export default router;
