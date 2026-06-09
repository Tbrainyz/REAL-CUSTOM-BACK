const axios   = require('axios');
const { Invoice } = require('../models/Finance');
const { sendEmail } = require('../services/emailService');

const PAYSTACK_BASE = 'https://api.paystack.co';

// Paystack headers helper
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

// ─── POST /payments/paystack/initialize ───────────────────────────────────────
// Called when user clicks "Pay Now" on an invoice.
// Creates a Paystack transaction and returns the payment URL / access code.
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

    // Paystack expects amount in KOBO (multiply NGN by 100)
    const amountInKobo = Math.round(invoice.total * 100);

    const payload = {
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
    };

    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      payload,
      { headers: paystackHeaders() }
    );

    const { authorization_url, access_code, reference } = response.data.data;

    // Save reference on invoice so we can verify later
    await Invoice.findByIdAndUpdate(invoiceId, {
      paystackReference: reference,
      status: 'sent',   // mark as sent/awaiting payment
    });

    res.json({
      success:           true,
      authorization_url,   // redirect user here OR open in popup
      access_code,          // use with Paystack inline JS
      reference,
    });

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('Paystack initialize error:', msg);
    next(err);
  }
};

// ─── POST /payments/paystack/verify ───────────────────────────────────────────
// Called after payment redirect / webhook to confirm payment was successful.
exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Transaction reference is required' });
    }

    // Verify with Paystack
    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: paystackHeaders() }
    );

    const txn = response.data.data;

    if (txn.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: `Payment not successful. Status: ${txn.status}`,
      });
    }

    // Find invoice by reference
    const invoice = await Invoice.findOneAndUpdate(
      { paystackReference: reference, user: req.user._id },
      {
        status: 'paid',
        paidAt: new Date(),
        paystackData: {
          transactionId: txn.id,
          channel:       txn.channel,
          currency:      txn.currency,
          paidAt:        txn.paid_at,
          amount:        txn.amount / 100,  // convert back from kobo
        },
      },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found for this reference' });
    }

    // Send payment confirmation email to client
    if (invoice.clientEmail) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;background:#f9f9f9">
          <div style="background:white;border-radius:12px;padding:30px;border:1px solid #e5e7eb">
            <div style="text-align:center;margin-bottom:24px">
              <div style="width:60px;height:60px;background:#10b981;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
                <span style="color:white;font-size:28px">✓</span>
              </div>
              <h2 style="color:#10b981;margin:0">Payment Confirmed!</h2>
            </div>
            <p>Dear <strong>${invoice.client}</strong>,</p>
            <p>We have received your payment. Thank you!</p>
            <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:20px 0">
              <table style="width:100%">
                <tr><td style="color:#6b7280;padding:4px 0">Invoice Number</td><td style="font-weight:600;text-align:right">${invoice.invoiceNumber}</td></tr>
                <tr><td style="color:#6b7280;padding:4px 0">Amount Paid</td><td style="font-weight:600;text-align:right;color:#10b981">₦${invoice.total.toLocaleString()}</td></tr>
                <tr><td style="color:#6b7280;padding:4px 0">Payment Method</td><td style="font-weight:600;text-align:right;text-transform:capitalize">${txn.channel}</td></tr>
                <tr><td style="color:#6b7280;padding:4px 0">Transaction ID</td><td style="font-weight:600;text-align:right;font-size:12px">${txn.id}</td></tr>
              </table>
            </div>
            <p style="color:#6b7280;font-size:13px">This is an automated payment confirmation. Please keep this for your records.</p>
          </div>
        </div>`;

      sendEmail(invoice.clientEmail, `Payment Confirmed — Invoice ${invoice.invoiceNumber}`, html)
        .catch(err => console.warn('Payment confirmation email failed:', err.message));
    }

    res.json({ success: true, message: 'Payment verified successfully', data: invoice });

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('Paystack verify error:', msg);
    next(err);
  }
};

// ─── GET /payments/paystack/status/:reference ─────────────────────────────────
// Quick status check — used by frontend to poll payment state.
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: paystackHeaders() }
    );

    const txn = response.data.data;
    res.json({
      success: true,
      data: {
        status:    txn.status,
        amount:    txn.amount / 100,
        channel:   txn.channel,
        reference: txn.reference,
        paidAt:    txn.paid_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /payments/paystack/webhook ──────────────────────────────────────────
// Paystack calls this automatically when a payment completes.
// Set this URL in your Paystack dashboard: yourdomain.com/payments/paystack/webhook
exports.webhook = async (req, res) => {
  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    // Reject requests not from Paystack
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      const reference = data.reference;
      const invoice   = await Invoice.findOne({ paystackReference: reference });

      if (invoice && invoice.status !== 'paid') {
        await Invoice.findByIdAndUpdate(invoice._id, {
          status: 'paid',
          paidAt: new Date(),
          paystackData: {
            transactionId: data.id,
            channel:       data.channel,
            currency:      data.currency,
            paidAt:        data.paid_at,
            amount:        data.amount / 100,
          },
        });
        console.log(`✅ Webhook: Invoice ${invoice.invoiceNumber} marked paid`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.sendStatus(200); // always 200 to Paystack
  }
};
