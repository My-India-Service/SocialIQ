import mongoose from 'mongoose';

const checkoutLinkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ref: { type: String, required: true, unique: true },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
    customerHandle: { type: String, default: '' },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR' },
    provider: { type: String, enum: ['razorpay', 'upi'], required: true },
    /** Short URL customers open (Razorpay hosted page or our /pay page). */
    url: { type: String, required: true },
    providerLinkId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['created', 'opened', 'paid', 'expired'],
      default: 'created',
    },
    openedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

checkoutLinkSchema.index({ user: 1, createdAt: -1 });
checkoutLinkSchema.index({ providerLinkId: 1 });

export default mongoose.model('CheckoutLink', checkoutLinkSchema);
