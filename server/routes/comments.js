import express from 'express';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { analyzeComment, buildAutoDmPreview, buildDailyReport, buildRoiSummary, regenerateSuggestedReply } from '../services/ai.js';
import { hasAnyIntegration, routeLead } from '../services/integrations.js';
import { csvDateStamp, rowsToCsv } from '../utils/csv.js';

const router = express.Router();

router.use(authRequired);

function commentListFilter(userId, query) {
  const { category, platform, status, q, temperature } = query;
  const filter = { user: userId };
  if (category && category !== 'all') filter.category = category;
  if (platform && platform !== 'all') filter.platform = platform;
  if (status && status !== 'all') filter.status = status;
  if (temperature && temperature !== 'all') filter.leadTemperature = temperature;
  if (q) filter.text = { $regex: q, $options: 'i' };
  return filter;
}

const EXPORT_COLUMNS = [
  'postedAt',
  'platform',
  'author',
  'authorHandle',
  'text',
  'category',
  'purchaseProbability',
  'leadTemperature',
  'expectedOrderValue',
  'sentiment',
  'status',
  'suggestedReply',
  'postTitle',
  'routedTo',
  'sentToSalesAt',
  'revenueAttributed',
  'analysisSource',
];

router.get('/', async (req, res) => {
  try {
    const filter = commentListFilter(req.userId, req.query);
    const comments = await Comment.find(filter).sort({ postedAt: -1 }).limit(200);
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/export.csv', async (req, res) => {
  try {
    const filter = commentListFilter(req.userId, req.query);
    const comments = await Comment.find(filter).sort({ postedAt: -1 }).limit(5000);
    const rows = comments.map((c) => ({
      postedAt: c.postedAt ? new Date(c.postedAt).toISOString() : '',
      platform: c.platform || '',
      author: c.author || '',
      authorHandle: c.authorHandle || '',
      text: c.text || '',
      category: c.category || '',
      purchaseProbability: c.purchaseProbability ?? '',
      leadTemperature: c.leadTemperature || '',
      expectedOrderValue: c.expectedOrderValue ?? '',
      sentiment: c.sentiment || '',
      status: c.status || '',
      suggestedReply: c.suggestedReply || '',
      postTitle: c.postTitle || '',
      routedTo: Array.isArray(c.routedTo) ? c.routedTo.join('|') : '',
      sentToSalesAt: c.sentToSalesAt ? new Date(c.sentToSalesAt).toISOString() : '',
      revenueAttributed: c.revenueAttributed ?? '',
      analysisSource: c.analysisSource || '',
    }));

    const csv = rowsToCsv(EXPORT_COLUMNS, rows, { bom: true });
    const filename = `voxa-leads-${csvDateStamp()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const comments = await Comment.find({ user: req.userId });
    const stats = {
      total: comments.length,
      sales_opportunity: 0,
      complaint: 0,
      feature_request: 0,
      positive_feedback: 0,
      competitor_mention: 0,
      spam: 0,
      new: comments.filter((c) => c.status === 'new').length,
      hot: comments.filter((c) => c.leadTemperature === 'hot').length,
      avgPurchaseProbability: 0,
      pipelineValue: 0,
    };

    let probSum = 0;
    for (const c of comments) {
      if (c.category === 'sales_opportunity') stats.sales_opportunity += 1;
      else if (c.category === 'feature_request') stats.feature_request += 1;
      else if (c.category === 'positive_feedback') stats.positive_feedback += 1;
      else if (c.category === 'spam') stats.spam += 1;
      else if (c.category === 'competitor_mention') stats.competitor_mention += 1;

      if (['complaint', 'shipping_issue', 'refund_request'].includes(c.category)) {
        stats.complaint += 1;
      }
      probSum += c.purchaseProbability;
      if (c.category === 'sales_opportunity') {
        stats.pipelineValue += c.expectedOrderValue || 0;
      }
    }
    stats.avgPurchaseProbability = comments.length ? Math.round(probSum / comments.length) : 0;
    stats.avgOrderValue = user?.avgOrderValue ?? 2499;
    stats.currency = user?.currency || 'INR';

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/insights', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const comments = await Comment.find({ user: req.userId });
    const reportOptions = {
      avgOrderValue: user?.avgOrderValue ?? 2499,
      currency: user?.currency || 'INR',
    };
    const report = buildDailyReport(comments, reportOptions);
    res.json({
      featureRequests: report.featureRequestGroups,
      competitors: report.competitorIntel,
      complaintThemes: report.complaintThemes,
      productRoadmap: report.productRoadmap,
      viral: report.mostViralComment,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/roi', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const comments = await Comment.find({ user: req.userId });
    const roi = buildRoiSummary(comments, {
      avgOrderValue: user?.avgOrderValue ?? 2499,
      currency: user?.currency || 'INR',
    });
    res.json({ roi, brandName: user?.brandName });
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

    const analysis = await analyzeComment(text, user.brandTone, user.avgOrderValue);
    let autoDmStatus = 'none';
    let autoDmPreview = '';
    if (user.autoDm?.enabled && analysis.category === 'sales_opportunity') {
      autoDmStatus = 'queued';
      autoDmPreview = buildAutoDmPreview(user, text);
    }

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
      autoDmStatus,
      autoDmPreview,
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
    const analysis = await analyzeComment(text, user.brandTone, user.avgOrderValue);
    res.json({
      analysis: {
        ...analysis,
        autoDmPreview:
          user.autoDm?.enabled && analysis.category === 'sales_opportunity'
            ? buildAutoDmPreview(user, text)
            : '',
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status, suggestedReply, revenueAttributed } = req.body;
    const patch = {
      ...(status && { status }),
      ...(suggestedReply !== undefined && { suggestedReply }),
    };
    if (status === 'converted') {
      const existing = await Comment.findOne({ _id: req.params.id, user: req.userId });
      if (!existing) return res.status(404).json({ message: 'Comment not found' });
      patch.revenueAttributed =
        revenueAttributed !== undefined
          ? Number(revenueAttributed)
          : existing.revenueAttributed || existing.expectedOrderValue || 0;
    }

    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      patch,
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

    const next = await regenerateSuggestedReply(
      comment.text,
      comment.category,
      user.brandTone,
      comment.suggestedReply
    );
    comment.suggestedReply = next.suggestedReply;
    comment.analysisSource = next.analysisSource;
    await comment.save();
    res.json({ comment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Send lead to Slack / WhatsApp / CRM. */
router.post('/:id/send-to-sales', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (!hasAnyIntegration(user)) {
      return res.status(400).json({
        message:
          'No sales destinations configured. Add Slack webhook, WhatsApp notify phone, or CRM webhook in Settings.',
      });
    }

    const channels = req.body?.channels || 'all';
    const result = await routeLead(user, comment, channels);
    if (!result.routed) {
      return res.status(400).json({
        message: result.message || 'Routing failed',
        results: result.results,
      });
    }

    const merged = new Set([...(comment.routedTo || []), ...result.routedChannels]);
    comment.routedTo = [...merged];
    comment.sentToSalesAt = new Date();
    if (comment.status === 'new' || comment.status === 'reviewed') {
      comment.status = 'sent_to_sales';
    }
    await comment.save();

    res.json({ comment, routing: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Queue / preview Auto DM for a sales comment. */
router.post('/:id/auto-dm', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const preview = buildAutoDmPreview(user, comment.text);
    const markSent = Boolean(req.body?.markSent);

    comment.autoDmPreview = preview;
    comment.autoDmStatus = markSent ? 'sent' : 'queued';
    await comment.save();

    res.json({
      comment,
      note: markSent
        ? 'Marked as sent. Connect Instagram Messaging API to deliver real DMs.'
        : 'Auto DM queued. Preview ready — enable Instagram Messaging to deliver.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
