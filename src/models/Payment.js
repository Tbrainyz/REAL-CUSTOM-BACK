const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reference: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  method: { type: String, enum: ['paystack', 'bank_transfer', 'cash', 'other'], required: true },
  status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
  description: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  paystackData: { type: mongoose.Schema.Types.Mixed },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  paidAt: { type: Date },
}, { timestamps: true });

paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ reference: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
