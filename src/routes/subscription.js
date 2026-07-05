const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');

// Temporarily return mock data so frontend doesn't crash with 404
router.get('/status', protect, (req, res) => {
  res.json({
    success: true,
    data: {
      status:        'active',
      plan:          'Professional',
      billing:       'monthly',
      trialEndsAt:   null,
      trialDaysLeft: 999,
      hasAccess:     true,
      bypassTrial:   true,
    },
  });
});

// Keep activate endpoint so pricing page doesn't break
router.post('/activate', protect, (req, res) => {
  res.json({ success: true, message: 'Subscription activated (test mode)' });
});

module.exports = router;
