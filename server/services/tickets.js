import Comment from '../models/Comment.js';
import Ticket from '../models/Ticket.js';
import { COMPLAINT_CATEGORIES, scoreComplaint, severityRank } from './complaintSeverity.js';
import { logWarn } from './logger.js';

export const SLA_HOURS = { critical: 4, high: 8, medium: 24, low: 48 };
const GROUP_WINDOW_MS = 72 * 60 * 60 * 1000;

const TOPIC_RULES = [
  ['REFUND', /refund|money\s*back|paise\s*wapas|return/i],
  ['DELIVERY', /deliver|shipping|courier|dispatch|not\s+received|still\s+waiting|where\s+is\s+my\s+order|late/i],
  ['QUALITY', /broke|broken|defective|faulty|stopped\s+working|quality|damaged|tear|crack/i],
  ['SIZE', /\bsize\b|\bfit\b|too\s+(small|large|big|tight)/i],
  ['BILLING', /charged|payment|double\s+charge|invoice|upi|paid/i],
  ['SUPPORT', /no\s+(one|reply|response)|nobody|not\s+responding|customer\s+care|support/i],
];

export const TOPIC_LABELS = {
  REFUND: 'Refund',
  DELIVERY: 'Delivery delay',
  QUALITY: 'Product quality',
  SIZE: 'Size / fit',
  BILLING: 'Billing',
  SUPPORT: 'Support response',
  GENERAL: 'General complaint',
};

export function complaintTopic(comment) {
  if (comment.category === 'refund_request') return 'REFUND';
  if (comment.category === 'shipping_issue') return 'DELIVERY';
  const text = String(comment.text || '');
  for (const [topic, re] of TOPIC_RULES) {
    if (re.test(text)) return topic;
  }
  return 'GENERAL';
}

function slaDueFrom(start, priority) {
  return new Date(new Date(start).getTime() + (SLA_HOURS[priority] || 24) * 3600 * 1000);
}

async function createTicketWithNumber(fields) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const last = await Ticket.findOne({ user: fields.user }).sort({ number: -1 }).select('number');
    const number = (last?.number || 1000) + 1;
    try {
      return await Ticket.create({ ...fields, number });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw new Error('Could not allocate ticket number');
}

export function serializeTicket(ticket, comments = []) {
  const now = Date.now();
  const due = new Date(ticket.slaDueAt).getTime();
  const open = ticket.status !== 'resolved';
  return {
    id: ticket._id,
    number: ticket.number,
    label: `#T-${ticket.number}`,
    title: ticket.title,
    topic: ticket.topic,
    topicLabel: TOPIC_LABELS[ticket.topic] || ticket.topic,
    priority: ticket.priority,
    status: ticket.status,
    owner: ticket.owner || '',
    commentCount: ticket.comments?.length || 0,
    grouped: (ticket.comments?.length || 0) > 1,
    slaDueAt: ticket.slaDueAt,
    slaRemainingMs: open ? due - now : null,
    slaBreached: open ? due < now : Boolean(ticket.resolvedAt && new Date(ticket.resolvedAt).getTime() > due),
    firstResponseAt: ticket.firstResponseAt,
    resolvedAt: ticket.resolvedAt,
    createdAt: ticket.createdAt,
    webhookSyncedAt: ticket.webhookSyncedAt,
    webhookError: ticket.webhookError || '',
    comments: comments.map((c) => ({
      id: c._id,
      author: c.author,
      authorHandle: c.authorHandle || '',
      text: c.text,
      platform: c.platform,
      status: c.status,
      suggestedReply: c.suggestedReply || '',
      postedAt: c.postedAt || c.createdAt,
    })),
  };
}

/** POST ticket events to the helpdesk webhook (falls back to CRM webhook). */
export async function notifyHelpdesk(user, ticket, event, comments = []) {
  const url = user?.integrations?.helpdeskWebhookUrl || user?.integrations?.crmWebhookUrl;
  if (!url) return { sent: false, reason: 'No helpdesk webhook' };

  const payload = {
    event: `socialaidigital.ticket.${event}`,
    brand: user.brandName,
    ticket: serializeTicket(ticket, comments),
    sentAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Webhook ${res.status}`);
    ticket.webhookSyncedAt = new Date();
    ticket.webhookError = '';
    await ticket.save();
    return { sent: true };
  } catch (err) {
    ticket.webhookError = err.message;
    await ticket.save();
    logWarn(`Helpdesk webhook failed for ticket #T-${ticket.number}: ${err.message}`, {
      route: 'tickets.notifyHelpdesk',
      userId: String(user._id),
    });
    return { sent: false, reason: err.message };
  }
}

/**
 * Turn untracked complaints into tickets. Repeat complaints on the same topic within 72h are
 * grouped into the existing open ticket; priority escalates to the highest severity seen.
 */
export async function syncTicketsForUser(userId, user) {
  const pending = await Comment.find({
    user: userId,
    category: { $in: COMPLAINT_CATEGORIES },
    ticket: null,
    status: { $nin: ['ignored', 'converted'] },
    moderationStatus: { $ne: 'deleted' },
  })
    .sort({ postedAt: 1 })
    .limit(300);

  let created = 0;
  let grouped = 0;
  const touched = new Map();

  for (const comment of pending) {
    const { severity } = scoreComplaint(comment);
    const topic = complaintTopic(comment);
    const since = new Date(Date.now() - GROUP_WINDOW_MS);

    let ticket = await Ticket.findOne({
      user: userId,
      topic,
      status: { $in: ['open', 'in_progress'] },
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 });

    if (ticket) {
      ticket.comments.push(comment._id);
      if (severityRank(severity) < severityRank(ticket.priority)) {
        ticket.priority = severity;
        const tighter = slaDueFrom(ticket.createdAt, severity);
        if (tighter < ticket.slaDueAt) ticket.slaDueAt = tighter;
      }
      grouped += 1;
    } else {
      ticket = await createTicketWithNumber({
        user: userId,
        title: `${TOPIC_LABELS[topic]}: “${String(comment.text).slice(0, 70)}”`,
        topic,
        category: comment.category,
        priority: severity,
        owner: comment.assignedTo || '',
        comments: [comment._id],
        slaDueAt: slaDueFrom(new Date(), severity),
      });
      created += 1;
      touched.set(String(ticket._id), { ticket, event: 'created' });
    }

    if (comment.status === 'replied' && !ticket.firstResponseAt) {
      ticket.firstResponseAt = comment.postedReplyAt || new Date();
    }
    await ticket.save();

    comment.ticket = ticket._id;
    await comment.save();

    if (!touched.has(String(ticket._id))) {
      touched.set(String(ticket._id), { ticket, event: 'updated' });
    }
  }

  if (user) {
    for (const { ticket, event } of touched.values()) {
      const comments = await Comment.find({ _id: { $in: ticket.comments } }).limit(20);
      await notifyHelpdesk(user, ticket, event, comments);
    }
  }

  return { created, grouped };
}
