const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
  avatar: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  settings: {
    businessName: String,
    businessPhone: String,
    businessAddress: String,
    website: String,
    currency: { type: String, default: 'NGN' },
    timezone: { type: String, default: 'Africa/Lagos' },
  },
  apiKeys: {
    whatsappToken: { type: String, select: false },
    whatsappPhoneId: String,
    facebookToken: { type: String, select: false },
    facebookPageId: String,
    instagramToken: { type: String, select: false },
    paystackKey: { type: String, select: false },
  },
  bankDetails: {
    bankName: String,
    accountName: String,
    accountNumber: String,
    sortCode: String,
  },
  notificationPrefs: {
    emailOnFail: { type: Boolean, default: true },
    emailOnSuccess: { type: Boolean, default: false },
    browserAlerts: { type: Boolean, default: true },
    dailySummary: { type: Boolean, default: true },
  },
  // In User.js, add inside userSchema:
subscription: {
  status: { type: String, enum: ['active', 'inactive', 'trial'], default: 'trial' },
  plan: String,
  expiresAt: Date,
  paystackCustomerCode: String,
},
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
