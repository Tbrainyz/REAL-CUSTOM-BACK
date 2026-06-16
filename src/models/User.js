const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ─── Role definitions (single source of truth) ───────────────────────────────
const ROLES = {
  ADMIN:              'admin',
  INVENTORY_MANAGER:  'inventory_manager',
  FINANCE_MANAGER:    'finance_manager',
  MESSAGING_MANAGER:  'messaging_manager',
};

const ROLE_PERMISSIONS = {
  admin:              ['*'],                                           // everything
  inventory_manager:  ['inventory', 'stock_movements'],
  finance_manager:    ['invoices', 'expenses', 'cashflow', 'dashboard'],
  messaging_manager:  ['messaging', 'contacts', 'templates', 'logs'],
};

const userSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },

  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.ADMIN,
  },

  // Which admin account "owns" this sub-user (null for the top-level admin)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  avatar:    { type: String },
  isActive:  { type: Boolean, default: true },
  lastLogin: { type: Date },

  // Password Reset
  resetPasswordOTP:     { type: String,  select: false },
  resetPasswordExpires: { type: Date,    select: false },

  // Admin-level settings (sub-users inherit from admin but can't change these)
  settings: {
    businessName:    String,
    businessPhone:   String,
    businessAddress: String,
    website:         String,
    currency:   { type: String, default: 'NGN' },
    timezone:   { type: String, default: 'Africa/Lagos' },
  },
  apiKeys: {
    whatsappToken:   { type: String, select: false },
    whatsappPhoneId: String,
    facebookToken:   { type: String, select: false },
    facebookPageId:  String,
    instagramToken:  { type: String, select: false },
    paystackKey:     { type: String, select: false },
  },
  bankDetails: {
    bankName:       String,
    accountName:    String,
    accountNumber:  String,
    sortCode:       String,
  },
  notificationPrefs: {
    emailOnFail:    { type: Boolean, default: true  },
    emailOnSuccess: { type: Boolean, default: false },
    browserAlerts:  { type: Boolean, default: true  },
    dailySummary:   { type: Boolean, default: true  },
  },
  subscription: {
    status: { type: String, enum: ['active', 'inactive', 'trial'], default: 'trial' },
    plan:   String,
    expiresAt: Date,
    paystackCustomerCode: String,
  },
}, { timestamps: true });

// ─── Virtuals ────────────────────────────────────────────────────────────────
userSchema.virtual('permissions').get(function () {
  return ROLE_PERMISSIONS[this.role] || [];
});

userSchema.virtual('isAdmin').get(function () {
  return this.role === ROLES.ADMIN;
});

userSchema.set('toJSON',   { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// ─── Password hashing ────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// ─── Exports ─────────────────────────────────────────────────────────────────
const User = mongoose.model('User', userSchema);
module.exports = User;
module.exports.ROLES = ROLES;
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
