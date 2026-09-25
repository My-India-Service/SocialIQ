import crypto from 'crypto';
import CheckoutLink from '../models/CheckoutLink.js';
import Comment from '../models/Comment.js';
import Conversation from '../models/Conversation.js';
import { logInfo } from './logger.js';

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function publicServerUrl() {
  return (process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
}

export function checkoutAvailable(user) {
  return isRazorpayConfigured() || Boolean(user?.checkout?.upiId);
}

function newRef() {
  return `sa_${crypto.randomBytes(6).toString('hex')}`;
}

export function upiDeepLink({ upiId, payeeName, amount, ref, note }) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName || 'Merchant',
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tr: ref,
    tn: (note || `Order ${ref}`).slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}

async function createRazorpayLink({ amount, currency, ref, description, customerHandle, userId }) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency,
      reference_id: ref,
      description: description.slice(0, 2048),
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { ref, userId: String(userId), customer: customerHandle || '' },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.description || `Razorpay error ${res.status}`);
  }
  return { url: data.short_url, providerLinkId: data.id };
}

/**
 * Create a payment link for a lead (comment) or DM conversation.
 * Razorpay Payment Links when keys are set; otherwise a hosted UPI pay page.
 */
export async function createCheckoutLink(
  user,
  { amount, commentId, conversationId, conversation: conversationDoc, description } = {}
) {
  if (!checkoutAvailable(user)) {
    throw new Error('Add your UPI ID in Checkout settings (or set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) first');
  }

  const comment = commentId ? await Comment.findOne({ _id: commentId, user: user._id }) : null;
  if (commentId && !comment) throw new Error('Comment not found');
  let conversation =
    conversationDoc ||
    (conversationId ? await Conversation.findOne({ _id: conversationId, user: user._id }) : null);
  if (conversationId && !conversation) throw new Error('Conversation not found');
  if (!conversation && comment) {
    conversation = await Conversation.findOne({ user: user._id, comment: comment._id });
  }

  const value = Math.round(
    Number(amount) ||
      conversation?.orderValue ||
      comment?.expectedOrderValue ||
      user.avgOrderValue ||
      2499
  );
  if (value < 1) throw new Error('Amount must be at least 1');

  const currency = user.currency || 'INR';
  const ref = newRef();
  const customerHandle = conversation?.customerHandle || comment?.authorHandle || comment?.author || '';
  const label = description || `${user.brandName || 'Order'} — ${customerHandle || 'customer'}`;

  let provider = 'upi';
  let url = `${publicServerUrl()}/api/checkout/pay/${ref}`;
  let providerLinkId = '';
  if (isRazorpayConfigured()) {
    const rp = await createRazorpayLink({
      amount: value,
      currency,
      ref,
      description: label,
      customerHandle,
      userId: user._id,
    });
    provider = 'razorpay';
    url = rp.url;
    providerLinkId = rp.providerLinkId;
  }

  const link = await CheckoutLink.create({
    user: user._id,
    ref,
    comment: comment?._id || conversation?.comment || null,
    conversation: conversation?._id || null,
    customerHandle,
    amount: value,
    currency,
    provider,
    url,
    providerLinkId,
  });

  const commentRef = comment?._id || conversation?.comment;
  if (commentRef) {
    await Comment.updateOne(
      { _id: commentRef, status: { $in: ['new', 'reviewed'] } },
      { status: 'sent_to_sales' }
    );
  }

  return link;
}

export function checkoutMessage(link, user) {
  const amount = link.currency === 'INR' ? `₹${link.amount.toLocaleString('en-IN')}` : `${link.currency} ${link.amount}`;
  return `Pay ${amount} securely here to confirm your order${user?.brandName ? ` with ${user.brandName}` : ''}: ${link.url}`;
}

/** Mark paid and attribute revenue to the originating comment + conversation. */
export async function markCheckoutPaid(link, { amount } = {}) {
  if (link.status === 'paid') return link;
  const value = Number(amount) || link.amount;
  link.status = 'paid';
  link.paidAt = new Date();
  link.amount = value;
  await link.save();

  if (link.comment) {
    await Comment.updateOne({ _id: link.comment }, { status: 'converted', revenueAttributed: value });
  }
  if (link.conversation) {
    await Conversation.updateOne(
      { _id: link.conversation },
      { stage: 'converted', convertedAt: new Date(), orderValue: value }
    );
  }
  logInfo(`Checkout ${link.ref} paid (${link.currency} ${value})`, { userId: String(link.user) });
  return link;
}

export function verifyRazorpaySignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
