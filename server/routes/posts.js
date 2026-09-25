import express from 'express';
import Comment from '../models/Comment.js';
import PostCampaign from '../models/PostCampaign.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { buildContentIdeas, buildPostSummaries } from '../services/postAnalytics.js';
import { filterCommentsByPeriod, parseInsightsPeriod } from '../services/customerInsights.js';

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const period = parseInsightsPeriod(req.query.period);
    const [user, comments, campaigns] = await Promise.all([
      User.findById(req.userId).select('currency'),
      Comment.find({ user: req.userId, moderationStatus: { $ne: 'deleted' } })
        .sort({ postedAt: -1 })
        .limit(5000),
      PostCampaign.find({ user: req.userId }).select('platform externalPostId active objective'),
    ]);
    const periodComments = filterCommentsByPeriod(comments, period);
    const campaignByKey = new Map(
      campaigns.map((c) => [`${c.platform}::${c.externalPostId}`, c])
    );
    const posts = buildPostSummaries(periodComments).map((p) => {
      const campaign = campaignByKey.get(p.key);
      return {
        ...p,
        campaign: campaign
          ? { id: campaign._id, active: campaign.active, objective: campaign.objective }
          : null,
      };
    });
    res.json({
      period,
      currency: user?.currency || 'INR',
      posts,
      contentIdeas: buildContentIdeas(posts, { currency: user?.currency || 'INR' }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/detail', async (req, res) => {
  try {
    const platform = String(req.query.platform || '');
    const postId = String(req.query.postId || '');
    if (!platform || !postId) {
      return res.status(400).json({ message: 'platform and postId are required' });
    }
    const period = parseInsightsPeriod(req.query.period);
    const comments = await Comment.find({
      user: req.userId,
      platform,
      moderationStatus: { $ne: 'deleted' },
      $or: [{ videoId: postId }, { videoId: { $in: ['', null] }, postTitle: postId }],
    })
      .sort({ postedAt: -1 })
      .limit(1000);
    const periodComments = filterCommentsByPeriod(comments, period);
    const [summary] = buildPostSummaries(periodComments);
    const campaign = await PostCampaign.findOne({
      user: req.userId,
      platform,
      externalPostId: postId,
    });
    res.json({
      summary: summary || null,
      campaign,
      comments: periodComments.slice(0, 60).map((c) => ({
        id: c._id,
        author: c.author,
        authorHandle: c.authorHandle || '',
        text: c.text,
        category: c.category,
        sentiment: c.sentiment,
        leadTemperature: c.leadTemperature,
        purchaseProbability: c.purchaseProbability,
        status: c.status,
        revenueAttributed: c.revenueAttributed || 0,
        postedAt: c.postedAt || c.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
