import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    priceInr: { type: Number, default: 0 },
    blurb: { type: String, default: '' },
    features: { type: [String], default: [] },
    commentLimit: { type: Number, default: null },
    salesAgent: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    contactSales: { type: Boolean, default: false },
  },
  { _id: false }
);

const planSettingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'catalog', unique: true },
    trialDays: { type: Number, default: 30 },
    plans: { type: [planSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('PlanSettings', planSettingsSchema);
