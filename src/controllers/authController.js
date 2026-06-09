const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');
const { ROLES } = require('../models/User');
const { sendEmail } = require('../services/emailService');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  user.password = undefined;
  res.status(statusCode).json({ success: true, data: { token, user } });
};

// ─── PUBLIC: Register (first-time / self-serve admin signup) ──────────────────
// @route POST /auth/register
// Anyone can register here, but they always get role=admin (they are a new
// workspace owner). Sub-users are created by admins via POST /users.
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Self-registered users are always admin (workspace owners)
    // Give them a 3-day free trial
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const user = await User.create({
      name,
      email,
      password,
      role: ROLES.ADMIN,
      subscription: {
        status:      'trial',
        trialEndsAt,
      },
    });

    // Send welcome + trial email
    const trialEndFormatted = trialEndsAt.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const welcomeHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;background:#f9f9f9">
        <div style="background:white;border-radius:12px;padding:30px;border:1px solid #e5e7eb">
          <h2 style="color:#4F46E5;margin-top:0">Welcome to My Real Customer App! 🎉</h2>
          <p>Hi <strong>${name}</strong>, your account has been created successfully.</p>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0">
            <h3 style="color:#1d4ed8;margin:0 0 8px 0">⏱ Your 3-Day Free Trial</h3>
            <p style="margin:0;color:#1e40af">You have <strong>3 days</strong> of full access to explore all features.</p>
            <p style="margin:8px 0 0 0;color:#3730a3;font-size:14px">Trial ends: <strong>${trialEndFormatted}</strong></p>
          </div>
          <p>After your trial, choose a subscription plan to continue:</p>
          <ul style="color:#374151">
            <li>Starter — ₦9,900/month</li>
            <li>Professional — ₦24,900/month</li>
            <li>Enterprise — ₦59,900/month</li>
          </ul>
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" 
            style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#6366F1);color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:12px">
            Go to Dashboard →
          </a>
        </div>
      </div>`;

    sendEmail(email, 'Welcome! Your 3-day free trial has started', welcomeHtml)
      .catch(err => console.warn('Welcome email failed:', err.message));
    sendToken(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// ─── PUBLIC: Login ────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact your administrator.' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ─── PROTECTED: Get current user ──────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

// ─── PROTECTED: Update profile ────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, settings, bankDetails, notificationPrefs } = req.body;
    const updates = {};

    // Sub-users can only update their own name & email
    if (name) updates.name = name;
    if (email) updates.email = email;

    // Only admins can update business settings
    if (req.user.role === ROLES.ADMIN) {
      if (settings)           updates.settings           = { ...req.user.settings?.toObject?.() || {}, ...settings };
      if (bankDetails)        updates.bankDetails        = bankDetails;
      if (notificationPrefs)  updates.notificationPrefs  = notificationPrefs;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// ─── PROTECTED: Change password ───────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── PROTECTED (admin only): Update API keys ──────────────────────────────────
exports.updateApiKeys = async (req, res, next) => {
  try {
    const { whatsappToken, whatsappPhoneId, facebookToken, facebookPageId, instagramToken, paystackKey } = req.body;
    const apiKeys = {};
    if (whatsappToken)   apiKeys['apiKeys.whatsappToken']   = whatsappToken;
    if (whatsappPhoneId) apiKeys['apiKeys.whatsappPhoneId'] = whatsappPhoneId;
    if (facebookToken)   apiKeys['apiKeys.facebookToken']   = facebookToken;
    if (facebookPageId)  apiKeys['apiKeys.facebookPageId']  = facebookPageId;
    if (instagramToken)  apiKeys['apiKeys.instagramToken']  = instagramToken;
    if (paystackKey)     apiKeys['apiKeys.paystackKey']     = paystackKey;
    await User.findByIdAndUpdate(req.user._id, { $set: apiKeys });
    res.status(200).json({ success: true, message: 'API keys updated' });
  } catch (err) {
    next(err);
  }
};

// ─── PUBLIC: Forgot password — send OTP ──────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP     = otp;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#4F46E5">Password Reset Request</h2>
        <p>Hi ${user.name}, your one-time password is:</p>
        <h1 style="color:#4F46E5;font-size:40px;letter-spacing:8px;margin:20px 0">${otp}</h1>
        <p>Expires in <strong>15 minutes</strong>. Do not share it with anyone.</p>
      </div>`;
    await sendEmail(user.email, 'Password Reset OTP — My Real Customer App', html);

    res.status(200).json({ success: true, message: 'OTP sent to your email' });
  } catch (err) { next(err); }
};

// ─── PUBLIC: Verify OTP ───────────────────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

    res.status(200).json({ success: true, message: 'OTP verified' });
  } catch (err) { next(err); }
};

// ─── PUBLIC: Reset password ───────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP and new password are required' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

    user.password             = newPassword;
    user.resetPasswordOTP     = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully. You may now log in.' });
  } catch (err) { next(err); }
};

// ─── PUBLIC: Resend OTP ───────────────────────────────────────────────────────
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP     = otp;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#4F46E5">New OTP</h2>
        <p>Hi ${user.name}, here is your new OTP:</p>
        <h1 style="color:#4F46E5;font-size:40px;letter-spacing:8px;margin:20px 0">${otp}</h1>
        <p>Expires in <strong>15 minutes</strong>.</p>
      </div>`;
    await sendEmail(user.email, 'New OTP — My Real Customer App', html);

    res.status(200).json({ success: true, message: 'New OTP sent' });
  } catch (err) { next(err); }
};
