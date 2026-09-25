import express from 'express';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { FAQ_INTENT_QUESTIONS, buildFaqSuggestions } from '../services/faq.js';
import { buildShareOfVoice } from '../services/competitorSov.js';
import { parseInsightsPeriod } from '../services/customerInsights.js';

const router = express.Router();
router.use(authRequired);

const DAY = 24 * 60 * 60 * 1000;

async function recentComments(userId, days, fields) {
  return Comment.find({
    user: userId,
    postedAt: { $gte: new Date(Date.now() - days * DAY) },
    moderationStatus: { $ne: 'deleted' },
  })
    .select(fields)
    .sort({ postedAt: -1 })
    .limit(5000);
}

router.get('/faq', async (req, res) => {
  try {
    const period = parseInsightsPeriod(req.query.period);
    const [user, comments] = await Promise.all([
      User.findById(req.userId).select('faq'),
      recentComments(req.userId, period, 'text category postedAt createdAt'),
    ]);
    const suggestions = buildFaqSuggestions(comments, user?.faq || []);
    res.json({
      period,
      suggestions,
      unanswered: suggestions.filter((s) => s.needsAnswer).length,
      intents: FAQ_INTENT_QUESTIONS,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/faq', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.faq) ? req.body.faq : [];
    const faq = items
      .filter((f) => f && FAQ_INTENT_QUESTIONS[f.intent])
      .map((f) => ({
        intent: f.intent,
        answer: String(f.answer || '').trim().slice(0, 600),
        enabled: f.enabled !== false,
      }));
    const seen = new Set();
    const deduped = faq.filter((f) => (seen.has(f.intent) ? false : seen.add(f.intent)));
    await User.updateOne({ _id: req.userId }, { $set: { faq: deduped } });
    res.json({
      faq: deduped,
      message: `${deduped.filter((f) => f.answer && f.enabled).length} FAQ answer(s) now power AI replies`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/share-of-voice', async (req, res) => {
  try {
    const period = parseInsightsPeriod(req.query.period);
    const comments = await recentComments(
      req.userId,
      Math.max(period, 28),
      'text category competitorName postedAt createdAt'
    );
    const periodStart = Date.now() - period * DAY;
    const inPeriod = comments.filter((c) => new Date(c.postedAt || c.createdAt).getTime() >= periodStart);
    const sov = buildShareOfVoice(inPeriod);
    sov.weekly = buildShareOfVoice(comments).weekly;
    res.json({ period, ...sov });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
