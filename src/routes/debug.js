const express = require('express');
const router  = express.Router();
const { testEmail, testWhatsApp, testSMS } = require('../controllers/debugController');
const { protect, adminOnly } = require('../middleware/auth');
router.post('/test-email', protect, adminOnly, testEmail);
router.post('/test-whatsapp', protect, adminOnly, testWhatsApp);
router.post('/test-sms', protect, adminOnly, testSMS);
module.exports = router;
