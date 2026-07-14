import express from 'express';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { analyzeComment } from '../services/ai.js';

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const { category, platform, status, q } = req.query;
    const filter = { user: req.userId };
    if (category && category !== 'all') filter.category = category;
    if (platform && platform !== 'all') filter.platform = platform;
    if (status && status !== 'all') filter.status = status;
    if (q) filter.text = { $regex: q, $options: 'i' };

    const comments = await Comment.find(filter).sort({ postedAt: -1 }).limit(200);
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const comments = await Comment.find({ user: req.userId });
    const stats = {
      total: comments.length,
      sales_opportunity: 0,
      complaint: 0,
      feature_request: 0,
      positive_feedback: 0,
      spam: 0,
      new: comments.filter((c) => c.status === 'new').length,
      avgPurchaseProbability: 0,
    };

    let probSum = 0;
    for (const c of comments) {
      if (c.category === 'sales_opportunity') stats.sales_opportunity += 1;
      else if (c.category === 'feature_request') stats.feature_request += 1;
      else if (c.category === 'positive_feedback') stats.positive_feedback += 1;
      else if (c.category === 'spam') stats.spam += 1;

      if (['complaint', 'shipping_issue', 'refund_request'].includes(c.category)) {
        stats.complaint += 1;
      }
      probSum += c.purchaseProbability;
    }
    stats.avgPurchaseProbability = comments.length
      ? Math.round(probSum / comments.length)
      : 0;

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { platform, postTitle, author, authorHandle, text, likes, replies, isVip } = req.body;
    if (!platform || !author || !text) {
      return res.status(400).json({ message: 'platform, author, and text are required' });
    }

    const analysis = await analyzeComment(text, user.brandTone);
    const comment = await Comment.create({
      user: req.userId,
      platform,
      postTitle: postTitle || '',
      author,
      authorHandle: authorHandle || '',
      text,
      likes: likes || 0,
      replies: replies || 0,
      isViral: (likes || 0) + (replies || 0) >= 100,
      isVip: Boolean(isVip),
      ...analysis,
    });

    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'text is required' });
    res.json({ analysis: await analyzeComment(text, user.brandTone) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status, suggestedReply } = req.body;
    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      {
        ...(status && { status }),
        ...(suggestedReply !== undefined && { suggestedReply }),
      },
      { new: true }
    );
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    res.json({ comment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/regenerate-reply', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const analysis = await analyzeComment(comment.text, user.brandTone);
    comment.suggestedReply = analysis.suggestedReply;
    comment.category = analysis.category;
    comment.purchaseProbability = analysis.purchaseProbability;
    comment.sentiment = analysis.sentiment;
    comment.analysisSource = analysis.analysisSource;
    await comment.save();
    res.json({ comment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
