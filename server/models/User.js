import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    brandName: { type: String, default: 'My Brand' },
    brandTone: {
      type: String,
      enum: ['friendly', 'professional', 'playful', 'luxury'],
      default: 'friendly',
    },
    /** Average order value used for revenue estimates (INR by default). */
    avgOrderValue: { type: Number, default: 2499, min: 0 },
    currency: { type: String, default: 'INR' },
    integrations: {
      slackWebhookUrl: { type: String, default: '' },
      whatsappWebhookUrl: { type: String, default: '' },
      crmWebhookUrl: { type: String, default: '' },
      /** Auto-route hot leads (purchaseProbability >= threshold) on sync. */
      autoRouteHotLeads: { type: Boolean, default: false },
      hotLeadThreshold: { type: Number, default: 80, min: 0, max: 100 },
    },
    autoDm: {
      enabled: { type: Boolean, default: false },
      catalogueUrl: { type: String, default: '' },
      couponCode: { type: String, default: '' },
      websiteUrl: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
