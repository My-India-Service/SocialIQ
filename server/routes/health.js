import express from 'express';
import Comment from '../models/Comment.js';
import CrisisAlert from '../models/CrisisAlert.js';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { computeBrandHealth } from '../services/brandHealth.js';
import { evaluateCrisisForUser } from '../services/crisisMonitor.js';

const router = express.Router();
router.use(authRequired);

const DAY = 24 * 60 * 60 * 1000;

function serializeAlert(a) {
  return {
    id: a._id,
    type: a.type,
    severity: a.severity,
    reason: a.reason,
    metrics: a.metrics,
    channels: a.channels || [],
    acknowledgedAt: a.acknowledgedAt,
    createdAt: a.createdAt,
    samples: (a.sampleComments || [])
      .filter((c) => c && typeof c === 'object' && c.text)
      .map((c) => ({
        id: c._id,
        author: c.author,
        platform: c.platform,
        text: c.text,
      })),
  };
}

function crisisSettings(user) {
  return {
    enabled: user?.crisis?.enabled !== false,
    keywords: user?.crisis?.keywords || [],
    alertEmail: user?.crisis?.alertEmail || '',
    lastCheckedAt: user?.crisis?.lastCheckedAt || null,
  };
}

router.get('/', async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * DAY);
    const [user, comments, tickets, alerts] = await Promise.all([
      User.findById(req.userId).select('avgOrderValue currency crisis'),
      Comment.find({ user: req.userId, postedAt: { $gte: since } }).select(
        'category sentiment status postedAt createdAt expectedOrderValue moderationStatus text likes replies isViral escalated'
      ),
      Ticket.find({ user: req.userId, createdAt: { $gte: since } }).select('status slaDueAt'),
      CrisisAlert.find({ user: req.userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('sampleComments', 'author platform text'),
    ]);

    const health = computeBrandHealth(comments, tickets, {
      avgOrderValue: user?.avgOrderValue ?? 2499,
    });

    res.json({
      currency: user?.currency || 'INR',
      health,
      crisis: {
        settings: crisisSettings(user),
        activeCount: alerts.filter((a) => !a.acknowledgedAt).length,
        alerts: alerts.map(serializeAlert),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/crisis/check', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('email brandName crisis integrations');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const result = await evaluateCrisisForUser(user, { notify: true });
    if (result.skipped) {
      return res.json({ ...result, message: 'Crisis monitoring is turned off' });
    }
    res.json({
      lastHourNegative: result.lastHourNegative,
      baselineHourlyNegative: result.baselineHourlyNegative,
      created: result.alerts.length,
      message: result.alerts.length
        ? `${result.alerts.length} new alert(s) raised and sent`
        : `All clear — ${result.lastHourNegative} negative comment(s) in the last hour (normal ≈ ${result.baselineHourlyNegative}/hr)`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/crisis/settings', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { enabled, keywords, alertEmail } = req.body || {};
    user.crisis = user.crisis || {};
    if (enabled !== undefined) user.crisis.enabled = Boolean(enabled);
    if (keywords !== undefined) {
      const list = Array.isArray(keywords) ? keywords : String(keywords).split(/[,\n]/);
      user.crisis.keywords = [
        ...new Set(list.map((k) => String(k).trim().toLowerCase()).filter(Boolean)),
      ].slice(0, 50);
    }
    if (alertEmail !== undefined) user.crisis.alertEmail = String(alertEmail).trim();
    user.markModified('crisis');
    await user.save();
    res.json({ settings: crisisSettings(user), message: 'Crisis alert settings saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/crisis/:id/ack', async (req, res) => {
  try {
    const alert = await CrisisAlert.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { acknowledgedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ message: 'Alert acknowledged' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
