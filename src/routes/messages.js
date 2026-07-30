const { attachWorkspace } = require('../middleware/workspace');
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const {
  sendNow, scheduleMessage, getScheduled, cancelScheduled, getLogs,
} = require('../controllers/messageController');
const { protect, requireRole } = require('../middleware/auth');
const { checkTrial } = require('../middleware/checkTrial');

// Multer setup for image/file attachments
if (!fs.existsSync('uploads/messages')) {
  fs.mkdirSync('uploads/messages', { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/messages/'),
    filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only images and documents allowed'));
  },
});

router.use(protect, checkTrial, attachWorkspace, requireRole('messaging_manager'));

// Accept up to 10 files on the send endpoint
router.post('/send',            upload.array('media', 10), sendNow);
router.post('/schedule',        upload.array('media', 10), scheduleMessage);
router.get('/scheduled',        getScheduled);
router.delete('/scheduled/:id', cancelScheduled);
router.get('/logs',             getLogs);

module.exports = router;
