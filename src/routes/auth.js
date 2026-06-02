const express = require('express');
const router  = express.Router();
const {
  register, login, getMe, updateProfile, changePassword,
  forgotPassword, verifyOTP, resetPassword, resendOTP, updateApiKeys,
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/register',         register);
router.post('/login',            login);
router.post('/forgot-password',  forgotPassword);
router.post('/verify-otp',       verifyOTP);
router.post('/reset-password',   resetPassword);
router.post('/resend-otp',       resendOTP);

// ── Protected (any logged-in user) ────────────────────────────────────────────
router.get('/me',            protect, getMe);
router.put('/profile',       protect, updateProfile);
router.put('/password',      protect, changePassword);

// ── Admin only ────────────────────────────────────────────────────────────────
router.put('/api-keys',      protect, adminOnly, updateApiKeys);

module.exports = router;
