import express from 'express';
import CheckoutLink from '../models/CheckoutLink.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import {
  checkoutAvailable,
  createCheckoutLink,
  isRazorpayConfigured,
  markCheckoutPaid,
  upiDeepLink,
  verifyRazorpaySignature,
} from '../services/checkout.js';
import { logError, logWarn } from '../services/logger.js';

const router = express.Router();

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function serializeLink(l) {
  return {
    id: l._id,
    ref: l.ref,
    url: l.url,
    amount: l.amount,
    currency: l.currency,
    provider: l.provider,
    status: l.status,
    customerHandle: l.customerHandle,
    comment: l.comment,
    conversation: l.conversation,
    openedAt: l.openedAt,
    paidAt: l.paidAt,
    createdAt: l.createdAt,
  };
}

function settingsFor(user) {
  return {
    enabled: Boolean(user?.checkout?.enabled),
    upiId: user?.checkout?.upiId || '',
    payeeName: user?.checkout?.payeeName || user?.brandName || '',
    sendInDm: user?.checkout?.sendInDm !== false,
    razorpay: isRazorpayConfigured(),
    available: checkoutAvailable(user),
  };
}

/* ---------- Public: hosted UPI pay page ---------- */
router.get('/pay/:ref', async (req, res) => {
  try {
    const link = await CheckoutLink.findOne({ ref: req.params.ref });
    if (!link) return res.status(404).send('Payment link not found');
    if (link.provider === 'razorpay') return res.redirect(link.url);

    const user = await User.findById(link.user).select('brandName checkout');
    if (link.status === 'created') {
      link.status = 'opened';
      link.openedAt = new Date();
      await link.save();
    }
    const upiId = user?.checkout?.upiId || '';
    const payee = user?.checkout?.payeeName || user?.brandName || 'Merchant';
    const deep = upiDeepLink({ upiId, payeeName: payee, amount: link.amount, ref: link.ref });
    const amount = `₹${link.amount.toLocaleString('en-IN')}`;
    const paid = link.status === 'paid';

    res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pay ${escapeHtml(payee)}</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f5f7;color:#16181d;display:grid;place-items:center;min-height:100vh;padding:1rem;box-sizing:border-box}
.card{background:#fff;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.08);padding:1.75rem;max-width:380px;width:100%;text-align:center}
h1{font-size:1.05rem;margin:0 0 .25rem;color:#555;font-weight:600}
.amt{font-size:2.4rem;font-weight:800;margin:.25rem 0 1rem}
a.btn{display:block;background:#5b3df5;color:#fff;text-decoration:none;padding:.95rem;border-radius:12px;font-weight:700;margin:.5rem 0}
.upi{font-family:ui-monospace,monospace;background:#f1f1f4;padding:.5rem .75rem;border-radius:8px;display:inline-block;margin:.5rem 0;user-select:all}
small{color:#777;display:block;margin-top:.75rem;line-height:1.4}
.ok{color:#0a8a4a;font-weight:700;font-size:1.1rem}
</style></head><body><div class="card">
<h1>${escapeHtml(payee)}</h1>
<div class="amt">${escapeHtml(amount)}</div>
${
  paid
    ? '<p class="ok">✓ Payment received — thank you!</p>'
    : `<a class="btn" href="${escapeHtml(deep)}">Pay with any UPI app</a>
<p>or pay to UPI ID<br><span class="upi">${escapeHtml(upiId)}</span></p>
<small>Order ref <b>${escapeHtml(link.ref)}</b> — add it in the payment note. After paying, reply to the brand with a screenshot so they can confirm your order.</small>`
}
</div></body></html>`);
  } catch (err) {
    logError(err, { route: 'GET /api/checkout/pay/:ref' });
    res.status(500).send('Something went wrong');
  }
});

/* ---------- Public: Razorpay webhook ---------- */
router.post('/razorpay/webhook', async (req, res) => {
  try {
    if (!verifyRazorpaySignature(req.rawBody, req.get('x-razorpay-signature'))) {
      logWarn('Razorpay webhook signature invalid', { route: 'checkout.razorpayWebhook' });
      return res.status(400).json({ message: 'Invalid signature' });
    }
    const event = req.body?.event;
    if (event === 'payment_link.paid') {
      const entity = req.body?.payload?.payment_link?.entity || {};
      const link =
        (entity.id && (await CheckoutLink.findOne({ providerLinkId: entity.id }))) ||
        (entity.reference_id && (await CheckoutLink.findOne({ ref: entity.reference_id })));
      if (link) {
        const paise = entity.amount_paid || entity.amount;
        await markCheckoutPaid(link, { amount: paise ? paise / 100 : undefined });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logError(err, { route: 'POST /api/checkout/razorpay/webhook' });
    res.status(500).json({ message: err.message });
  }
});

/* ---------- Authenticated ---------- */
router.get('/', authRequired, async (req, res) => {
  try {
    const [user, links] = await Promise.all([
      User.findById(req.userId).select('brandName checkout currency'),
      CheckoutLink.find({ user: req.userId }).sort({ createdAt: -1 }).limit(100),
    ]);
    const paid = links.filter((l) => l.status === 'paid');
    res.json({
      settings: settingsFor(user),
      currency: user?.currency || 'INR',
      stats: {
        created: links.length,
        opened: links.filter((l) => l.status !== 'created').length,
        paid: paid.length,
        revenue: paid.reduce((s, l) => s + l.amount, 0),
      },
      links: links.map(serializeLink),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/settings', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { enabled, upiId, payeeName, sendInDm } = req.body || {};
    user.checkout = user.checkout || {};
    if (upiId !== undefined) {
      const id = String(upiId).trim();
      if (id && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(id)) {
        return res.status(400).json({ message: 'UPI ID looks invalid (e.g. brand@okhdfcbank)' });
      }
      user.checkout.upiId = id;
    }
    if (payeeName !== undefined) user.checkout.payeeName = String(payeeName).trim().slice(0, 60);
    if (sendInDm !== undefined) user.checkout.sendInDm = Boolean(sendInDm);
    if (enabled !== undefined) user.checkout.enabled = Boolean(enabled);
    user.markModified('checkout');
    await user.save();
    res.json({ settings: settingsFor(user), message: 'Checkout settings saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/links', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { commentId, conversationId, amount, description } = req.body || {};
    const link = await createCheckoutLink(user, { commentId, conversationId, amount, description });
    res.status(201).json({ link: serializeLink(link) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/links/:id/paid', authRequired, async (req, res) => {
  try {
    const link = await CheckoutLink.findOne({ _id: req.params.id, user: req.userId });
    if (!link) return res.status(404).json({ message: 'Link not found' });
    await markCheckoutPaid(link, { amount: req.body?.amount });
    res.json({ link: serializeLink(link), message: 'Marked paid — revenue attributed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
