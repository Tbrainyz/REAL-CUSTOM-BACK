const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  company: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  whatsapp: { type: String, trim: true },
  facebook: { type: String, trim: true },
  instagram: { type: String, trim: true },
  tiktok: { type: String, trim: true },
  reels: { type: String, trim: true },
  tags: [{ type: String, trim: true }],
  segment: { type: String, trim: true },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  source: { type: String, enum: ['manual', 'import', 'api'], default: 'manual' },
}, { timestamps: true });

contactSchema.index({ user: 1, name: 1 });
contactSchema.index({ user: 1, phone: 1 });
contactSchema.index({ user: 1, whatsapp: 1 });

module.exports = mongoose.model('Contact', contactSchema);
