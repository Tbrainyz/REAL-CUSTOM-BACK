const express = require('express');
const router  = express.Router();
const { testEmail, testWhatsApp } = require('../controllers/debugController');
const { protect, adminOnly } = require('../middleware/auth');
router.post('/test-email', protect, adminOnly, testEmail);
router.post('/test-whatsapp', protect, adminOnly, testWhatsApp);
module.exports = router;
