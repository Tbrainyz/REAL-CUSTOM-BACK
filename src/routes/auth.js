const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const {
  register, login, getMe, updateProfile, changePassword,
  forgotPassword, verifyOTP, resetPassword, resendOTP, updateApiKeys, updateAvatar,
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');

// Avatar upload setup
const avatarDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename:    (req, file, cb) => cb(null, `avatar_${req.user._id}_${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only image files allowed (jpg, png, webp, gif)'));
  },
});

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
router.put('/avatar',        protect, avatarUpload.single('avatar'), updateAvatar);

// ── Admin only ────────────────────────────────────────────────────────────────
router.put('/api-keys',      protect, adminOnly, updateApiKeys);

module.exports = router;
