const axios   = require('axios');
const crypto  = require('crypto');
const { Invoice } = require('../models/Finance');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE   = 'https://api.paystack.co';

// ─── Helper: Paystack authenticated request ───────────────────────────────────
const paystack = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    'Content-Type': 'application/json',
  },
});

// ─── POST /payments/paystack/initialize ───────────────────────────────────────
// Called by frontend when client clicks "Pay Now" on an invoice.
// Returns an authorization_url to redirect/open the Paystack popup.
exports.initializePayment = async (req, res, next) => {
  try {
    const { invoiceId, email } = req.body;

    if (!invoiceId || !email) {
      return res.status(400).json({ success: false, message: 'invoiceId and email are required' });
    }

    // Fetch the invoice
    const invoice = await Invoice.findOne({ _id: invoiceId, user: req.user._id });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoice is already paid' });
    }

    // Paystack expects amount in kobo (NGN × 100)
    const amountInKobo = Math.round(invoice.total * 100);

    const response = await paystack.post('/transaction/initialize', {
      email,
      amount:    amountInKobo,
      currency:  'NGN',
      reference: `INV-${invoice.invoiceNumber}-${Date.now()}`,
      metadata: {
        invoiceId:     invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        client:        invoice.client,
        userId:        req.user._id.toString(),
      },
      callback_url: `${process.env.CLIENT_URL}/invoices?payment=success`,
    });

    const { authorization_url, access_code, reference } = response.data.data;

    // Save reference on invoice so we can verify later
    invoice.paystackReference = reference;
    await invoice.save({ validateBeforeSave: false });

    res.json({
      success: true,
      data: { authorization_url, access_code, reference },
    });
  } catch (err) {
    console.error('Paystack initialize error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err.response?.data?.message || 'Payment initialization failed',
    });
  }
};

// ─── POST /payments/paystack/verify ──────────────────────────────────────────
// Called by frontend after redirect/callback to confirm payment succeeded.
exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    // Verify with Paystack
    const response = await paystack.get(`/transaction/verify/${reference}`);
    const txn = response.data.data;

    if (txn.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: `Payment not successful. Status: ${txn.status}`,
      });
    }

    // Find invoice by reference
    const invoice = await Invoice.findOne({
      paystackReference: reference,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found for this payment' });
    }

    if (invoice.status === 'paid') {
      return res.json({ success: true, message: 'Invoice already marked as paid', data: invoice });
    }

    // Verify amount matches (kobo → naira)
    const paidAmount = txn.amount / 100;
    if (paidAmount < invoice.total) {
      return res.status(400).json({
        success: false,
        message: `Amount mismatch. Expected NGN ${invoice.total}, received NGN ${paidAmount}`,
      });
    }

    // Mark paid
    invoice.status  = 'paid';
    invoice.paidAt  = new Date();
    invoice.paidVia = 'paystack';
    await invoice.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Payment verified — invoice marked as paid',
      data: invoice,
    });
  } catch (err) {
    console.error('Paystack verify error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err.response?.data?.message || 'Payment verification failed',
    });
  }
};

// ─── POST /payments/paystack/webhook ─────────────────────────────────────────
// Paystack sends events here directly. Handles charge.success automatically.
// Add this URL in your Paystack dashboard → Settings → API Keys & Webhooks
exports.webhook = async (req, res) => {
  try {
    // Verify the request actually came from Paystack
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.warn('⚠️  Invalid Paystack webhook signature — ignored');
      return res.status(400).json({ success: false });
    }

    const { event, data } = req.body;
    console.log(`📩 Paystack webhook: ${event}`);

    if (event === 'charge.success') {
      const reference = data.reference;
      const invoice   = await Invoice.findOne({ paystackReference: reference });

      if (invoice && invoice.status !== 'paid') {
        invoice.status  = 'paid';
        invoice.paidAt  = new Date();
        invoice.paidVia = 'paystack';
        await invoice.save({ validateBeforeSave: false });
        console.log(`✅ Invoice ${invoice.invoiceNumber} marked paid via webhook`);
      }
    }

    // Always return 200 to Paystack
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(200).json({ received: true }); // still 200 so Paystack doesn't retry
  }
};

// ─── GET /payments/paystack/status/:reference ────────────────────────────────
// Frontend can poll this to check payment status without re-verifying
exports.checkStatus = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      paystackReference: req.params.reference,
      user: req.user._id,
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: { status: invoice.status, paidAt: invoice.paidAt } });
  } catch (err) { next(err); }
};
