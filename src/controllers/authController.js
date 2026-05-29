const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService'); // ← Correct path

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  user.password = undefined;
  res.status(statusCode).json({
    success: true,
    data: { token, user },
  });
};

// ==================== PASSWORD MANAGEMENT ====================

// @desc    Forgot Password - Send OTP
// @route   POST /auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user found with this email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = otpExpires;
    await user.save({ validateBeforeSave: false });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Password Reset Request</h2>
        <p>Your OTP for resetting your password is:</p>
        <h1 style="color: #4F46E5; font-size: 36px; letter-spacing: 4px;">${otp}</h1>
        <p>This OTP will expire in <strong>15 minutes</strong>.</p>
        <p style="color: #ef4444;"><strong>Do not share this code with anyone.</strong></p>
      </div>
    `;

    await sendEmail(user.email, 'Password Reset OTP - MessagePro', htmlContent);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify OTP
// @route   POST /auth/verify-otp
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and OTP' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Reset Password
// @route   POST /auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email, OTP and new password' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Resend OTP
// @route   POST /auth/resend-otp
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 15 * 60 * 1000;

    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = otpExpires;
    await user.save({ validateBeforeSave: false });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">New Password Reset OTP</h2>
        <p>Your new OTP is:</p>
        <h1 style="color: #4F46E5; font-size: 36px; letter-spacing: 4px;">${otp}</h1>
        <p>This OTP will expire in <strong>15 minutes</strong>.</p>
      </div>
    `;

    await sendEmail(user.email, 'New Password Reset OTP - MessagePro', htmlContent);

    res.status(200).json({
      success: true,
      message: 'New OTP sent to your email successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ==================== EXISTING FUNCTIONS ====================

// @desc  Register user
// @route POST /auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, role: role || 'admin' });
    sendToken(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// @desc  Login user
// @route POST /auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc  Get current user
// @route GET /auth/me
exports.getMe = async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

// @desc  Update profile
// @route PUT /auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, settings, bankDetails, notificationPrefs } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (settings) updates.settings = { ...req.user.settings, ...settings };
    if (bankDetails) updates.bankDetails = bankDetails;
    if (notificationPrefs) updates.notificationPrefs = notificationPrefs;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc  Change password (logged in)
// @route PUT /auth/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
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

// @desc  Update API keys
// @route PUT /auth/api-keys
exports.updateApiKeys = async (req, res, next) => {
  try {
    const { whatsappToken, whatsappPhoneId, facebookToken, facebookPageId, instagramToken, paystackKey } = req.body;

    const apiKeys = {};
    if (whatsappToken) apiKeys['apiKeys.whatsappToken'] = whatsappToken;
    if (whatsappPhoneId) apiKeys['apiKeys.whatsappPhoneId'] = whatsappPhoneId;
    if (facebookToken) apiKeys['apiKeys.facebookToken'] = facebookToken;
    if (facebookPageId) apiKeys['apiKeys.facebookPageId'] = facebookPageId;
    if (instagramToken) apiKeys['apiKeys.instagramToken'] = instagramToken;
    if (paystackKey) apiKeys['apiKeys.paystackKey'] = paystackKey;

    await User.findByIdAndUpdate(req.user._id, { $set: apiKeys });

    res.status(200).json({ success: true, message: 'API keys updated successfully' });
  } catch (err) {
    next(err);
  }
};