const express = require('express');
const router  = express.Router();
const {
  getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
} = require('../controllers/templateController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('messaging_manager'));

router.route('/').get(getTemplates).post(createTemplate);
router.route('/:id').get(getTemplate).put(updateTemplate).delete(deleteTemplate);

module.exports = router;
