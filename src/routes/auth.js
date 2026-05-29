const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  verifyOTP,
  resetPassword,
  resendOTP,
  updateApiKeys,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

// ===================== PUBLIC ROUTES =====================
router.post('/register', register);
router.post('/login', login);

router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/resend-otp', resendOTP);

// ===================== PROTECTED ROUTES =====================
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.put('/api-keys', protect, updateApiKeys);

module.exports = router;