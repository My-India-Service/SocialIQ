import mongoose from 'mongoose';

const crisisAlertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['spike', 'keyword'], required: true },
    severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
    reason: { type: String, required: true },
    metrics: {
      lastHourNegative: { type: Number, default: 0 },
      baselineHourlyNegative: { type: Number, default: 0 },
      keywordHits: { type: Number, default: 0 },
      keywords: { type: [String], default: [] },
    },
    sampleComments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    channels: { type: [String], default: [] },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

crisisAlertSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('CrisisAlert', crisisAlertSchema);
