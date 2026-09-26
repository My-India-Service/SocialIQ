import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import {
  processInboundDmMessage,
  sendHandoffNow,
  convertConversation,
} from '../services/conversationAgent.js';
import { sendInstagramDm, findInstagramConnection } from '../services/instagramMessaging.js';

const router = express.Router();

function authUserId(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return payload.id;
  } catch {
    return null;
  }
}

router.use((req, res, next) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ message: 'Authentication required' });
  req.userId = userId;
  next();
});

router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find({ user: req.userId })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .populate('comment', 'text author platform purchaseProbability status videoId');
    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/funnel', async (req, res) => {
  try {
    const [total, engaged, qualified, converted] = await Promise.all([
      Conversation.countDocuments({ user: req.userId }),
      Conversation.countDocuments({ user: req.userId, stage: { $in: ['engaged', 'qualified', 'converted'] } }),
      Conversation.countDocuments({ user: req.userId, stage: { $in: ['qualified', 'converted'] } }),
      Conversation.countDocuments({ user: req.userId, stage: 'converted' }),
    ]);
    const convRevenue = await Conversation.aggregate([
      { $match: { user: req.userId, stage: 'converted' } },
      { $group: { _id: null, total: { $sum: '$orderValue' } } },
    ]);
    res.json({
      funnel: {
        conversationsStarted: total,
        engaged,
        qualified,
        converted,
        conversationRevenue: convRevenue[0]?.total || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.userId })
      .populate('comment', 'text author authorHandle platform purchaseProbability status postTitle videoId')
      .populate('campaign', 'objective keywords dmLink bookingUrl');
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body || {};
    const allowed = ['new', 'engaged', 'qualified', 'converted', 'closed'];
    if (!allowed.includes(stage)) {
      return res.status(400).json({ message: 'Invalid stage' });
    }
    const conv = await Conversation.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { stage },
      { new: true }
    );
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.userId });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ message: 'text is required' });

    conversation.messages.push({ role: 'agent', text, sentAt: new Date() });
    conversation.lastMessageAt = new Date();
    await conversation.save();

    let dmSent = false;
    if (
      conversation.platform === 'instagram' &&
      conversation.instagramUserId &&
      process.env.META_INSTAGRAM_MESSAGING_ENABLED === 'true'
    ) {
      const connection = await findInstagramConnection(req.userId);
      if (connection) {
        await sendInstagramDm(connection, conversation.instagramUserId, text, { automated: false });
        dmSent = true;
      }
    }

    res.json({ conversation, dmSent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/handoff', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.userId });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const result = await sendHandoffNow({ user, conversation });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/convert', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.userId });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const conversationUpdated = await convertConversation({
      user,
      conversation,
      orderValue: req.body?.orderValue,
    });
    res.json({ conversation: conversationUpdated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Demo/pilot: simulate customer DM reply when IG webhook unavailable. */
router.post('/:id/simulate-inbound', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.userId });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ message: 'text is required' });

    const result = await processInboundDmMessage({
      user,
      conversation,
      text,
      sendDm: Boolean(req.body?.sendDm),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
