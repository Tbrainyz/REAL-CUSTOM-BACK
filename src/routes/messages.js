const express = require('express');
const router  = express.Router();
const {
  sendNow, scheduleMessage, getScheduled, cancelScheduled, getLogs,
} = require('../controllers/messageController');
const { checkTrial } = require('../middleware/checkTrial');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, checkTrial, requireRole('messaging_manager'));

router.post('/send',               sendNow);
router.post('/schedule',           scheduleMessage);
router.get('/scheduled',           getScheduled);
router.delete('/scheduled/:id',    cancelScheduled);
router.get('/logs',                getLogs);

module.exports = router;
