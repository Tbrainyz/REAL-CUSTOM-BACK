const { attachWorkspace } = require('../middleware/workspace');
const express = require('express');
const router  = express.Router();
const { checkTrial } = require('../middleware/checkTrial');
const { getLedger, exportLedger } = require('../controllers/bookkeepingController');
const { protect, adminOnly } = require('../middleware/auth');

// Admin only — this page aggregates data across Finance AND Inventory,
// which are otherwise siloed to their respective role dashboards.
router.use(protect, checkTrial, attachWorkspace, adminOnly);

router.get('/export', exportLedger);
router.get('/',       getLedger);

module.exports = router;
