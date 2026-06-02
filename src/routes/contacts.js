const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const {
  getContacts, getContact, createContact, updateContact, deleteContact,
  importContacts, exportContacts,
} = require('../controllers/contactController');
const { protect, requireRole } = require('../middleware/auth');

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename:    (req, file, cb) => cb(null, `contacts_${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only CSV and Excel files allowed'));
  },
});

router.use(protect, requireRole('messaging_manager'));

router.get('/export',              exportContacts);
router.post('/import', upload.single('file'), importContacts);
router.route('/').get(getContacts).post(createContact);
router.route('/:id').get(getContact).put(updateContact).delete(deleteContact);

module.exports = router;
