import './loadEnv.js';
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
import leadRoutes from './routes/leads.js';
import complaintRoutes from './routes/complaints.js';
import { isYouTubeConfigured } from './services/youtube.js';
import { isMetaConfigured } from './services/meta.js';
import { getLinkedInOAuthScopes, isLinkedInConfigured } from './services/linkedin.js';
import { isTikTokConfigured } from './services/tiktok.js';
import { logError, logFatal, logInfo } from './services/logger.js';

const app = express();
const PORT = process.env.PORT || 5001;

/** Comma-separated CLIENT_URL values; always allow local Vite in non-production. */
function corsOrigins() {
  const fromEnv = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origins = new Set(fromEnv);
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://localhost:5174');
    origins.add('http://127.0.0.1:5173');
    origins.add('http://127.0.0.1:5174');
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
  res.json({
    ok: true,
    product: 'Voxa',
    message: 'AI Revenue Intelligence API',
    oauth: {
      youtube: isYouTubeConfigured(),
      meta: isMetaConfigured(),
      linkedin: isLinkedInConfigured(),
      tiktok: isTikTokConfigured(),
    },
    linkedinScopes: isLinkedInConfigured() ? getLinkedInOAuthScopes() : [],
  });
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
app.use('/api/leads', leadRoutes);
app.use('/api/complaints', complaintRoutes);

// Express error handler — logs + alerts, then JSON response
app.use((err, req, res, _next) => {
  const status = Number(err.status || err.statusCode || 500);
  logError(err, {
    route: req.originalUrl || req.url,
    method: req.method,
    userId: req.userId ? String(req.userId) : undefined,
    status,
  });
  if (res.headersSent) return;
  res.status(status >= 400 ? status : 500).json({
    message: err.message || 'Internal server error',
  });
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logError(err, { route: 'unhandledRejection' });
});

process.on('uncaughtException', (err) => {
  logFatal(err, { route: 'uncaughtException' });
  setTimeout(() => process.exit(1), 500);
});

async function start() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voxa';
  await mongoose.connect(uri);
  logInfo('MongoDB connected');
  app.listen(PORT, () => {
    logInfo(`Voxa API running on http://localhost:${PORT}`);
    console.log(
      `OAuth: YouTube ${isYouTubeConfigured() ? 'On' : 'Off'} | Meta ${isMetaConfigured() ? 'On' : 'Off'} | LinkedIn ${isLinkedInConfigured() ? 'On' : 'Off'} | TikTok ${isTikTokConfigured() ? 'On' : 'Off'}`
    );
    if (isLinkedInConfigured()) {
      console.log(`LinkedIn OAuth scopes: ${getLinkedInOAuthScopes().join(' ')}`);
    }
  });
}

start().catch((err) => {
  logFatal(err, { route: 'startup' });
  setTimeout(() => process.exit(1), 500);
});
