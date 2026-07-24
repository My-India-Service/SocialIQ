import express from 'express';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { buildDailyReport, renderReportEmail } from '../services/ai.js';
import { isEmailConfigured, sendEmail } from '../services/mailer.js';

const router = express.Router();

router.use(authRequired);

async function loadReport(userId) {
  const since = new Date();
  since.setDate(since.getDate() - 1);

  let comments = await Comment.find({ user: userId, postedAt: { $gte: since } });
  // Fallback: if no "yesterday" comments, use all for demo value
  if (comments.length === 0) {
    comments = await Comment.find({ user: userId });
  }

  const user = await User.findById(userId).select('-password');
  const report = buildDailyReport(comments, {
    avgOrderValue: user?.avgOrderValue ?? 2499,
    currency: user?.currency || 'INR',
  });
  return { user, report };
}

router.get('/daily', async (req, res) => {
  try {
    const { user, report } = await loadReport(req.userId);
    res.json({
      brandName: user.brandName,
      emailConfigured: isEmailConfigured(),
      report,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/email-preview', async (req, res) => {
  try {
    const { user, report } = await loadReport(req.userId);
    const subject = `${user.brandName} — Daily CEO Report`;
    const { text } = renderReportEmail(user.brandName, report);

    res.json({
      to: user.email,
      from: process.env.REPORT_FROM || 'reports@voxa.app',
      subject,
      body: text,
      delivered: false,
      emailConfigured: isEmailConfigured(),
      note: isEmailConfigured()
        ? 'SMTP configured — click “Send now” to deliver.'
        : 'Add SMTP_HOST / SMTP_USER / SMTP_PASS to server/.env to send real email.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { user, report } = await loadReport(req.userId);
    if (!isEmailConfigured()) {
      return res.status(400).json({
        message: 'Email not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to server/.env.',
      });
    }

    const subject = `${user.brandName} — Daily CEO Report (${report.date})`;
    const { text, html } = renderReportEmail(user.brandName, report);
    const to = req.body?.to || user.email;

    const result = await sendEmail({ to, subject, text, html });
    res.json({
      delivered: result.delivered,
      to,
      subject,
      messageId: result.messageId || null,
      message: result.delivered ? `Report emailed to ${to}` : 'Email not sent',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
