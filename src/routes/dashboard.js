const express = require('express');
const router  = express.Router();
const { getStats, getRecentActivity, getCashFlow } = require('../controllers/dashboardController');
const { checkTrial } = require('../middleware/checkTrial');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, checkTrial);

// Stats and activity: accessible to admin + finance + inventory (all roles see their own slice)
router.get('/stats',    getStats);
router.get('/activity', getRecentActivity);

// Cash flow: only finance team and admin
router.get('/cashflow', requireRole('finance_manager'), getCashFlow);

module.exports = router;
