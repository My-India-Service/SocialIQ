import express from 'express';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import { processInboundDmMessage } from '../services/conversationAgent.js';
import { logError } from '../services/logger.js';

const router = express.Router();

function verifyWebhookChallenge({ mode, token, challenge }) {
  const expected = process.env.META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '';
  if (mode === 'subscribe' && token === expected && expected) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

function parseInstagramMessagingEvents(body) {
  const events = [];
  for (const entry of body?.entry || []) {
    for (const messaging of entry.messaging || []) {
      const senderId = messaging.sender?.id;
      const text = messaging.message?.text;
      const recipientId = messaging.recipient?.id;
      if (senderId && text?.trim()) {
        events.push({
          senderId,
          recipientId,
          text: text.trim(),
          timestamp: messaging.timestamp,
        });
      }
    }
  }
  return events;
}

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const result = verifyWebhookChallenge({ mode, token, challenge });
  if (result.ok) return res.status(200).send(result.challenge);
  return res.sendStatus(403);
});

router.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });

  try {
    const events = parseInstagramMessagingEvents(req.body || {});
    if (!events.length) return;

    for (const event of events) {
      const connections = await Connection.find({
        platform: 'instagram',
        status: 'connected',
        channelId: event.recipientId,
      });

      for (const conn of connections) {
        const user = await User.findById(conn.user);
        if (!user) continue;

        let conversation = await Conversation.findOne({
          user: conn.user,
          instagramUserId: event.senderId,
          platform: 'instagram',
        }).sort({ lastMessageAt: -1 });

        if (!conversation) {
          conversation = await Conversation.findOne({
            user: conn.user,
            customerHandle: event.senderId,
            platform: 'instagram',
          }).sort({ lastMessageAt: -1 });
        }

        if (!conversation) {
          conversation = await Conversation.create({
            user: conn.user,
            platform: 'instagram',
            instagramUserId: event.senderId,
            customerHandle: event.senderId,
            stage: 'engaged',
            messages: [],
          });
        }

        if (!conversation.instagramUserId) {
          conversation.instagramUserId = event.senderId;
        }

        await processInboundDmMessage({
          user,
          conversation,
          text: event.text,
          sendDm: true,
        });
      }
    }
  } catch (err) {
    logError(err, { route: '/api/instagram/webhook', method: 'POST' });
  }
});

export default router;
