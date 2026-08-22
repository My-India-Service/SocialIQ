import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import commentRoutes from './routes/comments.js';
import connectionRoutes from './routes/connections.js';
import reportRoutes from './routes/reports.js';
import whatsappRoutes from './routes/whatsapp.js';
import campaignRoutes from './routes/campaigns.js';
import conversationRoutes from './routes/conversations.js';
import billingRoutes from './routes/billing.js';
import instagramMessagingRoutes from './routes/instagramMessaging.js';

const app = express();
const PORT = process.env.PORT || 5000;

/** Comma-separated CLIENT_URL values; always allow local Vite in non-production. */
function corsOrigins() {
  const fromEnv = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origins = new Set(fromEnv);
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
  }
  return [...origins];
}

app.use(
  cors({
    origin: corsOrigins(),
    credentials: true,
    exposedHeaders: ['X-Export-Count', 'Content-Disposition'],
  })
);

// Capture raw body for Meta X-Hub-Signature-256 on WhatsApp webhooks.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith('/api/whatsapp/webhook')) {
        req.rawBody = buf;
      }
      if (req.originalUrl?.startsWith('/api/instagram/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, product: 'Voxa', message: 'AI Revenue Intelligence API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/instagram', instagramMessagingRoutes);

async function start() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voxa';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`Voxa API running on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
