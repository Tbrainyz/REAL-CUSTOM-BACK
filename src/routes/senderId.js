const express = require('express');
const router  = express.Router();
const { suggest, getStatus, submit } = require('../controllers/senderIdController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

router.get('/suggest',  suggest);
router.get('/status',   getStatus);
router.post('/submit',  submit);

module.exports = router;
