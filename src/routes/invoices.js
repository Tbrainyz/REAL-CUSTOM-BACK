const { attachWorkspace } = require('../middleware/workspace');
const express = require('express');
const router  = express.Router();
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, markInvoicePaid,
  exportInvoices, exportFinanceReport,
} = require('../controllers/financeController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, attachWorkspace, requireRole('finance_manager'));

// IMPORTANT: export routes must come BEFORE /:id to avoid being caught by it
router.get('/export',            exportInvoices);
router.get('/finance-report',    exportFinanceReport);
router.route('/').get(getInvoices).post(createInvoice);
router.route('/:id').get(getInvoice).put(updateInvoice).delete(deleteInvoice);
router.put('/:id/paid', markInvoicePaid);

module.exports = router;
