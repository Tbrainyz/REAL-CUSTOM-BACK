const express = require('express');
const router  = express.Router();
const {
  initializePayment,
  verifyPayment,
  getPaymentStatus,
  webhook,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Webhook — NO auth (called directly by Paystack servers)
// Must be raw body for signature verification
router.post('/paystack/webhook', express.raw({ type: 'application/json' }), webhook);

// Protected routes — any logged-in user can trigger payment
router.post('/paystack/initialize', protect, initializePayment);
router.post('/paystack/verify',     protect, verifyPayment);
router.get('/paystack/status/:reference', protect, getPaymentStatus);

module.exports = router;
