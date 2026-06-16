const express = require('express');
const router  = express.Router();
const { testEmail } = require('../controllers/debugController');
const { protect, adminOnly } = require('../middleware/auth');
router.post('/test-email', protect, adminOnly, testEmail);
module.exports = router;
