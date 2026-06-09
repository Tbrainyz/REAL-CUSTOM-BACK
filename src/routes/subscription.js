const express = require('express');
const router  = express.Router();
const { getStatus, activate, devBypass } = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

// No checkTrial here — these routes must work even when trial is expired
router.use(protect);

router.get('/status',   getStatus);   // GET  /subscription/status
router.post('/activate', activate);   // POST /subscription/activate
router.post('/dev-bypass', devBypass); // POST /subscription/dev-bypass (dev only)

module.exports = router;
