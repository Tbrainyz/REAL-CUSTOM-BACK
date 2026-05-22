const express = require('express');
const router = express.Router();
const { getStats, getRecentActivity, getCashFlow } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getStats);
router.get('/activity', getRecentActivity);
router.get('/cashflow', getCashFlow);

module.exports = router;
