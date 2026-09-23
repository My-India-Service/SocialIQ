import express from 'express';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import {
  COMPLAINT_CATEGORIES,
  scoreComplaint,
  severityRank,
} from '../services/complaintSeverity.js';
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

const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function activeComplaintFilter(userId) {
  return {
    user: userId,
    category: { $in: COMPLAINT_CATEGORIES },
    status: { $nin: ['ignored', 'converted'] },
  };
}

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'Just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function serializeComplaint(comment) {
  const scored = scoreComplaint(comment);
  return {
    id: comment._id,
    author: comment.author,
    authorHandle: comment.authorHandle || '',
    text: comment.text,
    platform: comment.platform,
    source: PLATFORM_LABELS[comment.platform] || comment.platform,
    category: comment.category,
    status: comment.status,
    suggestedReply: comment.suggestedReply || '',
    postedAt: comment.postedAt || comment.createdAt,
    relativeTime: relativeTime(comment.postedAt || comment.createdAt),
    severity: scored.severity,
    severityLabel: SEVERITY_LABELS[scored.severity],
    score: scored.score,
    tags: scored.tags,
    assignedTo: comment.assignedTo || '',
    escalated: Boolean(comment.escalated),
    likes: comment.likes || 0,
    replies: comment.replies || 0,
  };
}

router.get('/', async (req, res) => {
  try {
    const severityFilter = String(req.query.severity || 'all').toLowerCase();
    const comments = await Comment.find(activeComplaintFilter(req.userId)).limit(300);

    let items = comments.map(serializeComplaint);
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const item of items) {
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    }

    if (['critical', 'high', 'medium', 'low'].includes(severityFilter)) {
      items = items.filter((c) => c.severity === severityFilter);
    }

    items.sort((a, b) => {
      const rank = severityRank(a.severity) - severityRank(b.severity);
      if (rank !== 0) return rank;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });

    res.json({
      totalActive: comments.length,
      bySeverity,
      complaints: items,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      user: req.userId,
      category: { $in: COMPLAINT_CATEGORIES },
    });
    if (!comment) return res.status(404).json({ message: 'Complaint not found' });
    res.json({ complaint: serializeComplaint(comment) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      user: req.userId,
      category: { $in: COMPLAINT_CATEGORIES },
    });
    if (!comment) return res.status(404).json({ message: 'Complaint not found' });

    const message = String(req.body?.message || comment.suggestedReply || '').trim();
    if (!message) {
      return res.status(400).json({ message: 'Reply message is required' });
    }

    if (canPostReplyToPlatform(comment.platform)) {
      try {
        await postCommentReplyToPlatform(req.userId, comment, message);
        comment.suggestedReply = message;
        comment.status = 'replied';
        await comment.save();
        return res.json({
          complaint: serializeComplaint(comment),
          posted: true,
          message: 'Reply posted on platform',
        });
      } catch (err) {
        comment.suggestedReply = message;
        if (comment.status === 'new' || comment.status === 'reviewed') {
          comment.status = 'replied';
        }
        await comment.save();
        return res.status(err.status || 502).json({
          complaint: serializeComplaint(comment),
          posted: false,
          message: err.message || 'Could not post — reply saved locally',
        });
      }
    }

    comment.suggestedReply = message;
    if (['new', 'reviewed'].includes(comment.status)) {
      comment.status = 'replied';
    }
    await comment.save();
    res.json({
      complaint: serializeComplaint(comment),
      posted: false,
      message: 'Reply saved',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/assign', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name');
    const comment = await Comment.findOne({
      _id: req.params.id,
      user: req.userId,
      category: { $in: COMPLAINT_CATEGORIES },
    });
    if (!comment) return res.status(404).json({ message: 'Complaint not found' });

    comment.assignedTo = user?.name || 'Me';
    if (comment.status === 'new') comment.status = 'reviewed';
    await comment.save();
    res.json({
      complaint: serializeComplaint(comment),
      message: `Assigned to ${comment.assignedTo}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/escalate', async (req, res) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      user: req.userId,
      category: { $in: COMPLAINT_CATEGORIES },
    });
    if (!comment) return res.status(404).json({ message: 'Complaint not found' });

    comment.escalated = true;
    comment.escalatedAt = new Date();
    if (comment.status === 'new') comment.status = 'reviewed';
    await comment.save();
    res.json({
      complaint: serializeComplaint(comment),
      message: 'Escalated to critical',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
