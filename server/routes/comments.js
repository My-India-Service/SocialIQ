import express from 'express';
import Comment from '../models/Comment.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { analyzeComment, buildAutoDmPreview, buildDailyReport, buildRoiSummary, brandProfileFromUser, regenerateSuggestedReply } from '../services/ai.js';
import {
  bucketCustomerTopics,
  buildAiFindings,
  filterCommentsByPeriod,
  parseInsightsPeriod,
} from '../services/customerInsights.js';
import { hasAnyIntegration, routeLead } from '../services/integrations.js';
import { csvDateStamp, rowsToCsv } from '../utils/csv.js';
import {
  canPostReplyToPlatform,
  postCommentReplyToPlatform,
} from '../services/postReply.js';

const router = express.Router();

router.use(authRequired);

function postReplyHttpStatus(err) {
  const code = err.status || err.code;
  if (typeof code === 'number' && code >= 400 && code < 600) return code;
  return 500;
}

function formatPostReplyError(err) {
  let message = err.message || 'Post failed';
  const status = postReplyHttpStatus(err);
  const code = err.code;
  if (status === 429 || code === 429 || code === 4 || code === 17 || code === 32) {
    message = 'Meta rate limit — wait a minute and try again.';
  } else if (status === 409) {
    message =
      err.message ||
      'Reply already posted on this comment — use Copy reply to edit on the platform.';
  } else if ((status === 403 || status === 401) && !/connect/i.test(message)) {
    message += ' Open Connect to reconnect your account.';
  }
  return { message, status: status === 429 ? 429 : status };
}

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

const LEAD_EXPORT_COLUMNS = [
  'Date',
  'Platform',
  'Name',
  'Handle',
  'Comment',
  'Category',
  'Intent %',
  'Temperature',
  'Est. value',
  'Status',
  'Suggested reply',
  'Post',
  'Routed to',
  'Sent to sales at',
  'Revenue',
];

const ALL_EXPORT_COLUMNS = [...LEAD_EXPORT_COLUMNS, 'Sentiment', 'Analysis source'];

function applyLeadScope(filter, scope) {
  if (scope === 'all') return filter;
  return {
    ...filter,
    $or: [
      { category: 'sales_opportunity' },
      { leadTemperature: { $in: ['hot', 'warm'] } },
      { status: { $in: ['sent_to_sales', 'converted'] } },
    ],
  };
}

function commentToExportRow(c, { includeExtras = false } = {}) {
  const row = {
    Date: c.postedAt ? new Date(c.postedAt).toISOString() : '',
    Platform: c.platform || '',
    Name: c.author || '',
    Handle: c.authorHandle || '',
    Comment: c.text || '',
    Category: c.category || '',
    'Intent %': c.purchaseProbability ?? '',
    Temperature: c.leadTemperature || '',
    'Est. value': c.expectedOrderValue ?? '',
    Status: c.status || '',
    'Suggested reply': c.suggestedReply || '',
    Post: c.postTitle || '',
    'Routed to': Array.isArray(c.routedTo) ? c.routedTo.join('|') : '',
    'Sent to sales at': c.sentToSalesAt ? new Date(c.sentToSalesAt).toISOString() : '',
    Revenue: c.revenueAttributed ?? '',
  };
  if (includeExtras) {
    row.Sentiment = c.sentiment || '';
    row['Analysis source'] = c.analysisSource || '';
  }
  return row;
}

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
    const scope = req.query.scope === 'all' ? 'all' : 'leads';
    const base = commentListFilter(req.userId, req.query);
    const filter = applyLeadScope(base, scope);
    const comments = await Comment.find(filter).sort({ postedAt: -1 }).limit(5000);
    const includeExtras = scope === 'all';
    const columns = includeExtras ? ALL_EXPORT_COLUMNS : LEAD_EXPORT_COLUMNS;
    const rows = comments.map((c) => commentToExportRow(c, { includeExtras }));

    const csv = rowsToCsv(columns, rows, { bom: true });
    const filename =
      scope === 'all'
        ? `socialaidigital-comments-${csvDateStamp()}.csv`
        : `socialaidigital-leads-${csvDateStamp()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Count', String(comments.length));
    res.setHeader('Access-Control-Expose-Headers', 'X-Export-Count, Content-Disposition');
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
      byPlatform: {
        youtube: 0,
        instagram: 0,
        facebook: 0,
        linkedin: 0,
        whatsapp: 0,
        tiktok: 0,
        x: 0,
      },
    };

    let probSum = 0;
    for (const c of comments) {
      if (c.platform && stats.byPlatform[c.platform] != null) {
        stats.byPlatform[c.platform] += 1;
      }
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
    const period = parseInsightsPeriod(req.query.period);
    const periodComments = filterCommentsByPeriod(comments, period);
    const reportOptions = {
      avgOrderValue: user?.avgOrderValue ?? 2499,
      currency: user?.currency || 'INR',
    };
    const report = buildDailyReport(periodComments, reportOptions);
    res.json({
      period,
      topics: bucketCustomerTopics(periodComments),
      aiFindings: buildAiFindings(periodComments, comments, { periodDays: period }),
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
    const [convTotal, convQualified, convConverted, convRevenueAgg] = await Promise.all([
      Conversation.countDocuments({ user: req.userId }),
      Conversation.countDocuments({ user: req.userId, stage: { $in: ['qualified', 'converted'] } }),
      Conversation.countDocuments({ user: req.userId, stage: 'converted' }),
      Conversation.aggregate([
        { $match: { user: req.userId, stage: 'converted' } },
        { $group: { _id: null, total: { $sum: '$orderValue' } } },
      ]),
    ]);
    const roi = buildRoiSummary(comments, {
      avgOrderValue: user?.avgOrderValue ?? 2499,
      currency: user?.currency || 'INR',
      conversationStats: {
        conversationsStarted: convTotal,
        qualifiedLeads: convQualified,
        leadsConverted: convConverted,
        conversationRevenue: convRevenueAgg[0]?.total || 0,
      },
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

    const analysis = await analyzeComment(text, brandProfileFromUser(user));
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
    const analysis = await analyzeComment(text, brandProfileFromUser(user));
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
      brandProfileFromUser(user),
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

/** Post reply on YouTube/Facebook/Instagram and mark SocialAiDigital status replied. */
router.post('/:id/post-reply', async (req, res) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (!canPostReplyToPlatform(comment.platform)) {
      return res.status(400).json({
        message: `Posting replies is not supported for ${comment.platform} yet. Use Copy reply.`,
      });
    }

    const message = req.body?.message ?? comment.suggestedReply;
    const { platformReplyId } = await postCommentReplyToPlatform(
      req.userId,
      comment,
      message,
      { pace: false }
    );

    comment.suggestedReply = String(message).trim();
    comment.status = 'replied';
    comment.platformReplyId = platformReplyId;
    comment.postedReplyAt = new Date();
    comment.replyClaimedAt = undefined;
    await comment.save();

    res.json({ comment, posted: true, platformReplyId });
  } catch (err) {
    const { message, status } = formatPostReplyError(err);
    res.status(status).json({ message });
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

/** Queue / run AI sales agent (public reply + Instagram DM). */
router.post('/:id/auto-dm', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const comment = await Comment.findOne({ _id: req.params.id, user: req.userId });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const markSent = Boolean(req.body?.markSent);
    const runAgent = Boolean(req.body?.runAgent ?? true);

    if (runAgent && comment.platform === 'instagram') {
      const { runInstagramSalesAgentFlow } = await import('../services/instagramMessaging.js');
      const { findCampaignForComment } = await import('../services/campaignTriggers.js');
      const campaign = await findCampaignForComment(req.userId, comment);
      const result = await runInstagramSalesAgentFlow({ user, comment, campaign });
      comment.autoDmPreview = result.dmText || buildAutoDmPreview(user, comment.text);
      comment.autoDmStatus = result.dmSent || markSent ? 'sent' : 'queued';
      await comment.save();
      return res.json({
        comment,
        agent: result,
        note: result.dmSent
          ? 'Sales agent: public reply template + DM sent via Instagram Messaging API.'
          : result.reason === 'plan_upgrade_required'
            ? 'Upgrade to Growth plan for Instagram DM sales agent. Preview saved.'
            : result.messagingEnabled
              ? 'DM send failed — check Meta App Review for instagram_business_manage_messages.'
              : 'Set META_INSTAGRAM_MESSAGING_ENABLED=true after Meta approves messaging scope.',
      });
    }

    const preview = buildAutoDmPreview(user, comment.text);
    comment.autoDmPreview = preview;
    comment.autoDmStatus = markSent ? 'sent' : 'queued';
    await comment.save();

    res.json({
      comment,
      note: markSent
        ? 'Marked as sent. Enable Instagram Messaging for real DMs.'
        : 'Auto DM queued. Preview ready.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
