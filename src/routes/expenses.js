const express = require('express');
const router  = express.Router();
const {
  getExpenses, createExpense, updateExpense, deleteExpense,
} = require('../controllers/financeController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('finance_manager'));

router.route('/').get(getExpenses).post(createExpense);
router.route('/:id').put(updateExpense).delete(deleteExpense);

module.exports = router;
