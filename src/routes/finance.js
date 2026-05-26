const express = require('express');
const router = express.Router();
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, markInvoicePaid,
  getExpenses, createExpense, updateExpense, deleteExpense,
} = require('../controllers/financeController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// ==================== INVOICE ROUTES ====================
router.route('/invoices')
  .get(getInvoices)
  .post(createInvoice);

router.route('/invoices/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(deleteInvoice);

router.put('/invoices/:id/paid', markInvoicePaid);

// ==================== EXPENSE ROUTES ====================
router.route('/expenses')
  .get(getExpenses)
  .post(createExpense);

router.route('/expenses/:id')
  .put(updateExpense)
  .delete(deleteExpense);

module.exports = router;