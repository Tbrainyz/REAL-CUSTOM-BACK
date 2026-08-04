const { attachWorkspace } = require('../middleware/workspace');
const express = require('express');
const router  = express.Router();
const { checkTrial } = require('../middleware/checkTrial');
const { getLedger, exportLedger } = require('../controllers/bookkeepingController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, checkTrial, attachWorkspace, requireRole('finance_manager'));

// Export must come before any /:id style routes if added later
router.get('/export', exportLedger);
router.get('/',       getLedger);

module.exports = router;
