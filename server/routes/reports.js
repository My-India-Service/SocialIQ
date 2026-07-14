import express from 'express';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { buildDailyReport } from '../services/ai.js';

const router = express.Router();

router.use(authRequired);

router.get('/daily', async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 1);

    let comments = await Comment.find({
      user: req.userId,
      postedAt: { $gte: since },
    });

    // Fallback: if no "yesterday" comments, use all for demo value
    if (comments.length === 0) {
      comments = await Comment.find({ user: req.userId });
    }

    const user = await User.findById(req.userId).select('-password');
    const report = buildDailyReport(comments);

    res.json({
      brandName: user.brandName,
      report,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/email-preview', async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 1);
    let comments = await Comment.find({ user: req.userId, postedAt: { $gte: since } });
    if (comments.length === 0) {
      comments = await Comment.find({ user: req.userId });
    }

    const user = await User.findById(req.userId);
    const report = buildDailyReport(comments);

    const subject = `${user.brandName} — Daily CEO Report`;
    const body = [
      `Yesterday's Summary`,
      `${report.totalComments.toLocaleString()} comments analyzed`,
      ``,
      `Sales opportunities: ${report.salesOpportunities}`,
      `Estimated missed revenue: ₹${report.estimatedMissedRevenue.toLocaleString('en-IN')}`,
      ``,
      `Complaints: ${report.complaints}`,
      `Top complaint: ${report.topComplaint || '—'}`,
      ``,
      `Trending feature request: ${report.trendingFeatureRequest || '—'}`,
      `Competitor mentions: ${report.competitorMentions.join(', ') || '—'}`,
      ``,
      `Sentiment — 😊 ${report.sentiment.positive}%  😐 ${report.sentiment.neutral}%  😡 ${report.sentiment.negative}%`,
    ].join('\n');

    // SMTP is optional in MVP; always return preview payload
    res.json({
      to: user.email,
      from: process.env.REPORT_FROM || 'reports@voxa.app',
      subject,
      body,
      delivered: false,
      note: process.env.SMTP_HOST
        ? 'SMTP configured — wire nodemailer send in production.'
        : 'Add SMTP_* env vars to enable real email delivery.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
