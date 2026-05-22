const express = require('express');
const router = express.Router();
const { sendNow, scheduleMessage, getScheduled, cancelScheduled, getLogs } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.post('/send', sendNow);
router.post('/schedule', scheduleMessage);
router.get('/scheduled', getScheduled);
router.delete('/scheduled/:id', cancelScheduled);
router.get('/logs', getLogs);

module.exports = router;
