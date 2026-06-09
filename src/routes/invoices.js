const express = require('express');
const router  = express.Router();
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, markInvoicePaid,
} = require('../controllers/financeController');
const { checkTrial } = require('../middleware/checkTrial');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, checkTrial, requireRole('finance_manager'));

router.route('/').get(getInvoices).post(createInvoice);
router.route('/:id').get(getInvoice).put(updateInvoice).delete(deleteInvoice);
router.put('/:id/paid', markInvoicePaid);

module.exports = router;
