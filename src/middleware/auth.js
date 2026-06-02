const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { ROLES } = require('../models/User');

// ─── Attach user from JWT ─────────────────────────────────────────────────────
exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!req.user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact your administrator.' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized — token invalid' });
  }
};

// ─── Admin only ───────────────────────────────────────────────────────────────
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ─── Allow specific roles (admin always passes) ───────────────────────────────
// Usage:  requireRole('finance_manager', 'inventory_manager')
exports.requireRole = (...roles) => (req, res, next) => {
  if (req.user.role === ROLES.ADMIN) return next();   // admin can do anything
  if (roles.includes(req.user.role)) return next();
  return res.status(403).json({
    success: false,
    message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
  });
};

// ─── Legacy alias (backwards compat) ─────────────────────────────────────────
exports.authorize = (...roles) => exports.requireRole(...roles);
