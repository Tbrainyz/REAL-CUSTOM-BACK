const { attachWorkspace } = require('../middleware/workspace');
const express = require('express');
const router  = express.Router();
const {
  getExpenses, createExpense, updateExpense, deleteExpense, exportExpenses,
} = require('../controllers/financeController');
const { protect, requireRole, adminOnly } = require('../middleware/auth');

router.use(protect, attachWorkspace, requireRole('finance_manager'));

router.get('/export', adminOnly, exportExpenses);
router.route('/').get(getExpenses).post(createExpense);
router.route('/:id').put(updateExpense).delete(deleteExpense);

module.exports = router;
