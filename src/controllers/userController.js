const User   = require('../models/User');
const { ROLES, ROLE_PERMISSIONS } = require('../models/User');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  admin:              'Administrator',
  inventory_manager:  'Inventory Manager',
  finance_manager:    'Finance Manager',
  messaging_manager:  'Messaging Manager',
};

const ROLE_DESCRIPTIONS = {
  inventory_manager:  'Access to Products and Stock Movements only',
  finance_manager:    'Access to Invoices, Expenses and Cash Flow only',
  messaging_manager:  'Access to Messaging, Contacts and Templates only',
};

// ─── GET /users — list all sub-users under this admin ─────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      _id: { $ne: req.user._id },       // exclude the requesting admin
      createdBy: req.user._id,           // only show users this admin created
    };

    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role && Object.values(ROLES).includes(role)) {
      query.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).select('-password'),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page:  Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /users/roles — return available roles with descriptions ───────────────
exports.getRoles = async (req, res) => {
  const roles = Object.entries(ROLE_LABELS)
    .filter(([key]) => key !== ROLES.ADMIN)   // don't show admin in the "create user" dropdown
    .map(([value, label]) => ({
      value,
      label,
      description: ROLE_DESCRIPTIONS[value],
      permissions: ROLE_PERMISSIONS[value],
    }));
  res.json({ success: true, data: roles });
};

// ─── POST /users — admin creates a sub-user ───────────────────────────────────
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;

    // Validation
    if (!name || !email || !role) {
      return res.status(400).json({ success: false, message: 'Name, email and role are required' });
    }
    if (!Object.values(ROLES).includes(role) || role === ROLES.ADMIN) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Choose: ${Object.values(ROLES).filter(r => r !== ROLES.ADMIN).join(', ')}`,
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    // Auto-generate a secure temporary password
    const tempPassword = crypto.randomBytes(5).toString('hex') + 'A1!';  // e.g. "3f9a2bA1!"

    const user = await User.create({
      name,
      email,
      password: tempPassword,
      role,
      createdBy:  req.user._id,
      isActive:   true,
    });

    // Send welcome email with credentials
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;background:#f9f9f9">
        <div style="background:white;border-radius:12px;padding:30px;border:1px solid #e5e7eb">
          <h2 style="color:#4F46E5;margin-top:0">Welcome to My Real Customer App 👋</h2>
          <p>Hi <strong>${name}</strong>,</p>
          <p>Your account has been created by <strong>${req.user.name}</strong>.</p>
          
          <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:20px 0">
            <p style="margin:0 0 8px 0;font-weight:600">Your login credentials:</p>
            <p style="margin:4px 0">📧 <strong>Email:</strong> ${email}</p>
            <p style="margin:4px 0">🔑 <strong>Temporary Password:</strong> <code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:16px">${tempPassword}</code></p>
          </div>

          <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:0;color:#92400e">⚠️ <strong>Important:</strong> Please log in and change your password immediately.</p>
          </div>

          <div style="background:#eff6ff;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:0 0 8px 0;font-weight:600;color:#1d4ed8">Your Role: ${ROLE_LABELS[role]}</p>
            <p style="margin:0;color:#3730a3;font-size:14px">${ROLE_DESCRIPTIONS[role]}</p>
          </div>

          <p>Log in at: <a href="${process.env.FRONTEND_URL || 'https://myreal-customer-app.vercel.app'}/login" style="color:#4F46E5">My Real Customer App</a></p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#6b7280;font-size:12px">If you have any issues, contact your administrator.</p>
        </div>
      </div>`;

    // Send async — don't fail if email fails
    sendEmail(email, `You've been added to My Real Customer App`, html).catch(err =>
      console.warn('⚠️ Welcome email failed:', err.message)
    );

    user.password = undefined;
    res.status(201).json({
      success: true,
      message: `User created. Login credentials sent to ${email}`,
      data: user,
    });
  } catch (err) { next(err); }
};

// ─── GET /users/:id ───────────────────────────────────────────────────────────
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// ─── PUT /users/:id — update name, email or role ─────────────────────────────
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;

    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (role && (role === ROLES.ADMIN || !Object.values(ROLES).includes(role))) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const updates = {};
    if (name)  updates.name  = name;
    if (email) updates.email = email;
    if (role)  updates.role  = role;

    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ─── PUT /users/:id/toggle-status — activate / deactivate ────────────────────
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: user,
    });
  } catch (err) { next(err); }
};

// ─── PUT /users/:id/reset-password — admin resets a sub-user's password ───────
exports.resetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const tempPassword = crypto.randomBytes(5).toString('hex') + 'B2@';
    user.password = tempPassword;
    await user.save();

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px">
        <h2 style="color:#4F46E5">Password Reset</h2>
        <p>Hi <strong>${user.name}</strong>, your password has been reset by your administrator.</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:20px 0">
          <p style="margin:0 0 8px 0;font-weight:600">New temporary password:</p>
          <code style="font-size:18px;background:#e5e7eb;padding:4px 12px;border-radius:4px">${tempPassword}</code>
        </div>
        <p style="color:#dc2626;font-weight:600">Please log in and change this password immediately.</p>
      </div>`;

    sendEmail(user.email, 'Password Reset — My Real Customer App', html).catch(err =>
      console.warn('⚠️ Password reset email failed:', err.message)
    );

    res.json({ success: true, message: `Password reset. New credentials sent to ${user.email}` });
  } catch (err) { next(err); }
};

// ─── DELETE /users/:id ────────────────────────────────────────────────────────
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
};
