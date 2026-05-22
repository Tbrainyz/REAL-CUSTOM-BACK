const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, updateApiKeys } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.put('/api-keys', protect, updateApiKeys);

module.exports = router;
