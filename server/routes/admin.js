import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Connection from '../models/Connection.js';
import Comment from '../models/Comment.js';
import { adminCredentialsMatch, adminEmail } from '../config/admin.js';
import { ADMIN_TOKEN_PURPOSE, adminRequired } from '../middleware/admin.js';
import { buildAdminOverview } from '../services/adminOverview.js';
import { publicPlanCatalog, savePlanCatalog } from '../services/planCatalog.js';

const router = express.Router();

const USER_FIELDS =
  'name email brandName createdAt emailVerifiedAt onboarding onboardingCompletedAt subscription';

router.post('/login', (req, res) => {
  if (!adminEmail() || !process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ message: 'Admin login is not configured' });
  }
  const { email, password } = req.body || {};
  if (!adminCredentialsMatch(email, password)) {
    return res.status(401).json({ message: 'Incorrect admin email or password' });
  }
  const emailNormalized = adminEmail();
  const token = jwt.sign(
    { purpose: ADMIN_TOKEN_PURPOSE, email: emailNormalized },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, admin: { email: emailNormalized } });
});

router.use(adminRequired);

router.get('/plans', (_req, res) => {
  res.json(publicPlanCatalog());
});

router.put('/plans', async (req, res) => {
  try {
    const saved = await savePlanCatalog(req.body || {});
    res.json(saved);
  } catch (err) {
    const status = /must|required|Unknown plan/.test(err.message) ? 400 : 500;
    res.status(status).json({ message: err.message || 'Could not save plans' });
  }
});

router.get('/overview', async (_req, res) => {
  try {
    const [users, connections, commentCounts] = await Promise.all([
      User.find({})
        .select(USER_FIELDS)
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
      Connection.find({})
        .select('user platform accountName status connectedAt lastSyncedAt createdAt')
        .lean(),
      Comment.aggregate([{ $group: { _id: '$user', count: { $sum: 1 } } }]),
    ]);

    res.json(buildAdminOverview(users, connections, commentCounts));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not load admin data' });
  }
});

export default router;
