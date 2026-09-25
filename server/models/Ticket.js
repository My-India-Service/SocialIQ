import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    number: { type: Number, required: true },
    title: { type: String, default: '' },
    /** Grouping key: complaint topic (e.g. DELIVERY, REFUND, QUALITY). */
    topic: { type: String, default: 'GENERAL' },
    category: { type: String, default: 'complaint' },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },
    owner: { type: String, default: '' },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    slaDueAt: { type: Date, required: true },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    webhookSyncedAt: { type: Date, default: null },
    webhookError: { type: String, default: '' },
  },
  { timestamps: true }
);

ticketSchema.index({ user: 1, number: 1 }, { unique: true });
ticketSchema.index({ user: 1, status: 1, topic: 1 });

export default mongoose.model('Ticket', ticketSchema);
