import express from 'express';
import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { notifyHelpdesk, serializeTicket, syncTicketsForUser } from '../services/tickets.js';
import { severityRank } from '../services/complaintSeverity.js';
import { logError } from '../services/logger.js';

const router = express.Router();
router.use(authRequired);

const STATUSES = ['open', 'in_progress', 'resolved'];
const COMMENT_FIELDS = 'author authorHandle text platform status suggestedReply postedAt createdAt postedReplyAt';

async function loadUser(userId) {
  return User.findById(userId).select('brandName integrations');
}

/** Backfill first-response time from replied comments so SLA reporting stays accurate. */
async function backfillFirstResponse(ticket) {
  if (ticket.firstResponseAt) return;
  const replied = (ticket.comments || []).find(
    (c) => c && typeof c === 'object' && c.status === 'replied'
  );
  if (replied) {
    ticket.firstResponseAt = replied.postedReplyAt || new Date();
    await Ticket.updateOne({ _id: ticket._id }, { firstResponseAt: ticket.firstResponseAt });
  }
}

router.get('/', async (req, res) => {
  try {
    const user = await loadUser(req.userId);
    await syncTicketsForUser(req.userId, user);

    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    const filter = { user: req.userId };
    if (status) filter.status = status;

    const [tickets, countsAgg] = await Promise.all([
      Ticket.find(filter)
        .sort({ status: 1, slaDueAt: 1 })
        .limit(200)
        .populate({ path: 'comments', select: COMMENT_FIELDS }),
      Ticket.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(String(req.userId)) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    await Promise.all(tickets.map(backfillFirstResponse));

    const counts = { open: 0, in_progress: 0, resolved: 0 };
    for (const row of countsAgg) counts[row._id] = row.count;
    counts.all = counts.open + counts.in_progress + counts.resolved;

    const serialized = tickets
      .map((t) => serializeTicket(t, t.comments || []))
      .sort((a, b) => {
        const aOpen = a.status !== 'resolved';
        const bOpen = b.status !== 'resolved';
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        if (!aOpen) return new Date(b.resolvedAt || 0) - new Date(a.resolvedAt || 0);
        if (a.slaBreached !== b.slaBreached) return a.slaBreached ? -1 : 1;
        const pr = severityRank(a.priority) - severityRank(b.priority);
        if (pr) return pr;
        return (a.slaRemainingMs ?? 0) - (b.slaRemainingMs ?? 0);
      });

    const breached = serialized.filter((t) => t.slaBreached && t.status !== 'resolved').length;

    res.json({
      counts,
      breached,
      tickets: serialized,
      helpdeskWebhookUrl: user?.integrations?.helpdeskWebhookUrl || '',
    });
  } catch (err) {
    logError(err, { route: 'GET /api/tickets', userId: String(req.userId) });
    res.status(500).json({ message: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const user = await loadUser(req.userId);
    const result = await syncTicketsForUser(req.userId, user);
    res.json({
      ...result,
      message: `${result.created} new ticket(s), ${result.grouped} complaint(s) grouped into existing tickets`,
    });
  } catch (err) {
    logError(err, { route: 'POST /api/tickets/sync', userId: String(req.userId) });
    res.status(500).json({ message: err.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const url = String(req.body?.helpdeskWebhookUrl || '').trim();
    if (url && !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ message: 'Webhook URL must start with http:// or https://' });
    }
    await User.updateOne({ _id: req.userId }, { $set: { 'integrations.helpdeskWebhookUrl': url } });
    res.json({ helpdeskWebhookUrl: url, message: url ? 'Helpdesk webhook saved' : 'Helpdesk webhook removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, user: req.userId }).populate({
      path: 'comments',
      select: COMMENT_FIELDS,
    });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    await backfillFirstResponse(ticket);
    res.json({ ticket: serializeTicket(ticket, ticket.comments || []) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, user: req.userId });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const { status, owner } = req.body || {};
    if (status !== undefined) {
      if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });
      if (status === 'resolved' && ticket.status !== 'resolved') ticket.resolvedAt = new Date();
      if (status !== 'resolved') ticket.resolvedAt = null;
      if (status === 'in_progress' && !ticket.firstResponseAt) ticket.firstResponseAt = new Date();
      ticket.status = status;
    }
    if (owner !== undefined) ticket.owner = String(owner).trim().slice(0, 80);
    await ticket.save();

    if (status === 'resolved') {
      await Comment.updateMany(
        { _id: { $in: ticket.comments }, user: req.userId, status: 'new' },
        { status: 'reviewed' }
      );
    }

    const comments = await Comment.find({ _id: { $in: ticket.comments } }).select(COMMENT_FIELDS);
    const user = await loadUser(req.userId);
    const webhook = await notifyHelpdesk(user, ticket, 'updated', comments);

    res.json({ ticket: serializeTicket(ticket, comments), webhook });
  } catch (err) {
    logError(err, { route: 'PATCH /api/tickets/:id', userId: String(req.userId) });
    res.status(500).json({ message: err.message });
  }
});

export default router;
