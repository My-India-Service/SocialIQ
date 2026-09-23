import express from 'express';
import Comment from '../models/Comment.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import {
  analyzeCommentRules,
  brandProfileFromUser,
  leadTemperatureFromProbability,
  estimateExpectedOrderValue,
} from '../services/ai.js';
import { convertConversation } from '../services/conversationAgent.js';
import {
  canPostReplyToPlatform,
  postCommentReplyToPlatform,
} from '../services/postReply.js';

const router = express.Router();
router.use(authRequired);

const PLATFORM_LABELS = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  x: 'X',
  whatsapp: 'WhatsApp',
  manual: 'Manual',
};

function leadFilter(userId, temperature) {
  if (temperature && temperature !== 'all' && ['hot', 'warm', 'cold'].includes(temperature)) {
    return { user: userId, leadTemperature: temperature };
  }
  return {
    user: userId,
    $or: [
      { category: 'sales_opportunity' },
      { leadTemperature: { $in: ['hot', 'warm', 'cold'] } },
    ],
  };
}

function statusLabel(status) {
  if (status === 'converted') return 'Converted';
  if (status === 'ignored') return 'Ignored';
  if (['reviewed', 'replied', 'sent_to_sales'].includes(status)) return 'Contacted';
  return 'New';
}

function serializeLead(comment) {
  return {
    id: comment._id,
    person: comment.author,
    intent: comment.purchaseProbability || 0,
    temperature: comment.leadTemperature || 'none',
    source: PLATFORM_LABELS[comment.platform] || comment.platform,
    platform: comment.platform,
    status: comment.status,
    statusLabel: statusLabel(comment.status),
    value: comment.expectedOrderValue || 0,
    firstDetectedAt: comment.postedAt || comment.createdAt,
    text: comment.text,
    suggestedReply: comment.suggestedReply || '',
  };
}

function syntheticMessages(comment) {
  const messages = [];
  if (comment.text) {
    messages.push({
      role: 'customer',
      text: comment.text,
      sentAt: comment.postedAt || comment.createdAt,
    });
  }
  if (comment.suggestedReply) {
    messages.push({
      role: 'agent',
      text: comment.suggestedReply,
      sentAt: comment.updatedAt || comment.postedAt || comment.createdAt,
    });
  }
  return messages;
}

router.get('/', async (req, res) => {
  try {
    const temperature = String(req.query.temperature || 'all').toLowerCase();
    const comments = await Comment.find(leadFilter(req.userId, temperature))
      .sort({ purchaseProbability: -1, postedAt: -1 })
      .limit(200);
    const leads = comments.map(serializeLead);
    res.json({ total: leads.length, leads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Lead not found' });

    const conversation = await Conversation.findOne({
      user: req.userId,
      comment: comment._id,
    }).sort({ updatedAt: -1 });

    const messages = conversation?.messages?.length
      ? conversation.messages.map((m) => ({
          role: m.role,
          text: m.text,
          sentAt: m.sentAt,
        }))
      : syntheticMessages(comment);

    res.json({
      lead: serializeLead(comment),
      summary: {
        purchaseIntent: comment.purchaseProbability || 0,
        estimatedValue: comment.expectedOrderValue || 0,
        temperature: comment.leadTemperature || 'none',
        source: PLATFORM_LABELS[comment.platform] || comment.platform,
        firstDetectedAt: comment.postedAt || comment.createdAt,
        highIntent: (comment.purchaseProbability || 0) >= 80 || comment.leadTemperature === 'hot',
      },
      conversation: conversation
        ? {
            id: conversation._id,
            stage: conversation.stage,
            messages,
          }
        : {
            id: null,
            stage: null,
            messages,
            synthetic: true,
          },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const person = String(req.body?.person || '').trim();
    if (!person) return res.status(400).json({ message: 'Person name is required' });

    const text = String(req.body?.text || `${person} — manual lead`).trim();
    const profile = brandProfileFromUser(user);
    let analysis = null;
    if (req.body?.text) {
      analysis = analyzeCommentRules(text, profile);
    }

    const purchaseProbability =
      req.body?.purchaseProbability != null
        ? Math.max(0, Math.min(100, Number(req.body.purchaseProbability) || 0))
        : analysis?.purchaseProbability ?? 70;
    const expectedOrderValue =
      req.body?.expectedOrderValue != null
        ? Math.max(0, Number(req.body.expectedOrderValue) || 0)
        : analysis?.expectedOrderValue ??
          estimateExpectedOrderValue(purchaseProbability, user?.avgOrderValue ?? 2499);
    const leadTemperature =
      req.body?.leadTemperature && ['hot', 'warm', 'cold', 'none'].includes(req.body.leadTemperature)
        ? req.body.leadTemperature
        : leadTemperatureFromProbability(purchaseProbability);

    const platform = req.body?.platform === 'manual' || !req.body?.platform
      ? 'manual'
      : String(req.body.platform);

    const comment = await Comment.create({
      user: req.userId,
      platform: ['youtube', 'instagram', 'facebook', 'linkedin', 'tiktok', 'x', 'whatsapp', 'manual'].includes(
        platform
      )
        ? platform
        : 'manual',
      author: person,
      authorHandle: '',
      text,
      category: 'sales_opportunity',
      purchaseProbability,
      expectedOrderValue,
      leadTemperature,
      suggestedReply: analysis?.suggestedReply || '',
      analysisSource: analysis?.analysisSource || 'rules',
      status: 'new',
      postedAt: new Date(),
      externalId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });

    res.status(201).json({ lead: serializeLead(comment) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/contacted', async (req, res) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Lead not found' });

    if (comment.status === 'converted') {
      return res.json({ lead: serializeLead(comment), message: 'Already converted' });
    }

    comment.status = 'sent_to_sales';
    comment.sentToSalesAt = new Date();
    await comment.save();
    res.json({ lead: serializeLead(comment), message: 'Marked contacted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/convert', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Lead not found' });

    const value = Math.max(
      0,
      Number(req.body?.orderValue ?? req.body?.revenueAttributed ?? comment.expectedOrderValue) ||
        user?.avgOrderValue ||
        0
    );

    const conversation = await Conversation.findOne({
      user: req.userId,
      comment: comment._id,
    });

    if (conversation) {
      await convertConversation({ user, conversation, orderValue: value });
      const refreshed = await Comment.findById(comment._id);
      return res.json({
        lead: serializeLead(refreshed),
        message: `Converted — ₹${value.toLocaleString('en-IN')} attributed`,
      });
    }

    comment.status = 'converted';
    comment.revenueAttributed = value;
    await comment.save();
    res.json({
      lead: serializeLead(comment),
      message: `Converted — ₹${value.toLocaleString('en-IN')} attributed`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Lead not found' });

    const message = String(req.body?.message || comment.suggestedReply || '').trim();
    if (!message) {
      return res.status(400).json({ message: 'Reply message is required' });
    }

    if (canPostReplyToPlatform(comment.platform)) {
      try {
        await postCommentReplyToPlatform(req.userId, comment, message);
        comment.suggestedReply = message;
        if (comment.status === 'new' || comment.status === 'reviewed') {
          comment.status = 'replied';
        }
        await comment.save();
        return res.json({
          lead: serializeLead(comment),
          posted: true,
          message: 'Reply posted on platform',
        });
      } catch (err) {
        // Fall through to local save if post fails (user can copy)
        comment.suggestedReply = message;
        if (comment.status === 'new') comment.status = 'replied';
        await comment.save();
        return res.status(err.status || 502).json({
          lead: serializeLead(comment),
          posted: false,
          message: err.message || 'Could not post to platform — reply saved locally',
        });
      }
    }

    comment.suggestedReply = message;
    if (['new', 'reviewed'].includes(comment.status)) {
      comment.status = 'replied';
    }
    await comment.save();

    const conversation = await Conversation.findOne({
      user: req.userId,
      comment: comment._id,
    });
    if (conversation) {
      conversation.messages.push({ role: 'agent', text: message, sentAt: new Date() });
      if (conversation.stage === 'new') conversation.stage = 'engaged';
      await conversation.save();
    }

    res.json({
      lead: serializeLead(comment),
      posted: false,
      message: 'Reply saved (no platform post for this source)',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
