import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import commentRoutes from './routes/comments.js';
import connectionRoutes from './routes/connections.js';
import reportRoutes from './routes/reports.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, product: 'Voxa', message: 'AI Revenue Intelligence API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/reports', reportRoutes);

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
