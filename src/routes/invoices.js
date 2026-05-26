const express = require('express');
const router = express.Router();
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, markInvoicePaid,
} = require('../controllers/financeController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Invoice Routes
router.route('/')
  .get(getInvoices)
  .post(createInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(deleteInvoice);

router.put('/:id/paid', markInvoicePaid);

module.exports = router;