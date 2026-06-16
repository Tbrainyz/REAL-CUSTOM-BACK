const express = require('express');
const router = express.Router();
const { initializePaystack, verifyPaystack, paystackWebhook, getBankDetails, getPaymentHistory } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Webhook — no auth (called by Paystack servers)
router.post('/paystack/webhook', paystackWebhook);

router.use(protect);
router.post('/paystack/initialize', initializePaystack);
router.get('/paystack/verify/:reference', verifyPaystack);
router.get('/bank-details', getBankDetails);
router.get('/history', getPaymentHistory);

module.exports = router;
