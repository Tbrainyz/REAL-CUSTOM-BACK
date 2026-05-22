const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  user.password = undefined;
  res.status(statusCode).json({
    success: true,
    data: { token, user },
  });
};

// @desc  Register
// @route POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ name, email, password, role: role || 'admin' });
    sendToken(user, 201, res);
  } catch (err) { next(err); }
};

// @desc  Login
// @route POST /api/auth/login
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
  } catch (err) { next(err); }
};

// @desc  Get current user
// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

// @desc  Update profile
// @route PUT /api/auth/profile
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
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// @desc  Change password
// @route PUT /api/auth/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

// @desc  Update API keys
// @route PUT /api/auth/api-keys
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
    res.json({ success: true, message: 'API keys updated' });
  } catch (err) { next(err); }
};
