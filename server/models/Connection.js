import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: {
      type: String,
      enum: ['youtube', 'instagram', 'facebook', 'tiktok', 'x'],
      required: true,
    },
    accountName: { type: String, required: true },
    channelId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['connected', 'pending', 'disconnected'],
      default: 'connected',
    },
    accessToken: { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    tokenExpiry: { type: Date },
    lastSyncedAt: { type: Date },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

connectionSchema.index({ user: 1, platform: 1 }, { unique: true });

export default mongoose.model('Connection', connectionSchema);
