import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Comment from '../models/Comment.js';
import {
  createStripeCheckoutSession,
  getBillingCatalog,
  usageForUser,
} from '../services/billing.js';
import { getClientUrl } from '../utils/clientUrl.js';

const router = express.Router();

function authUser(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return payload.id;
  } catch {
    return null;
  }
}

router.get('/catalog', (_req, res) => {
  res.json(getBillingCatalog());
});

router.get('/usage', async (req, res) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const commentCount = await Comment.countDocuments({ user: userId });
    res.json({ usage: usageForUser(user, commentCount) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { planId } = req.body || {};
    const valid = ['starter', 'growth', 'business'];
    if (!valid.includes(planId)) {
      return res.status(400).json({ message: 'Invalid plan for checkout' });
    }

    const clientUrl = getClientUrl();
    const result = await createStripeCheckoutSession({
      planId,
      userEmail: user.email,
      successUrl: `${clientUrl}/app/billing?checkout=success&plan=${planId}`,
      cancelUrl: `${clientUrl}/app/billing?checkout=cancel`,
    });

    if (result.mock) {
      user.subscription = user.subscription || {};
      user.subscription.planId = planId;
      user.subscription.status = 'trialing';
      user.subscription.updatedAt = new Date();
      await user.save();
      return res.json({ mock: true, message: result.message, planId });
    }

    res.json({ url: result.url });
  } catch (err) {
    res.status(502).json({ message: err.message });
  }
});

export default router;
