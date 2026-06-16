const axios = require('axios');
const Payment = require('../models/Payment');
const { Invoice } = require('../models/Finance');
const User = require('../models/User');
const { paginateResult } = require('../middleware/paginate');
const crypto = require('crypto');

// @route POST /api/payments/paystack/initialize
exports.initializePaystack = async (req, res, next) => {
  try {
    const { amount, email, invoiceId, description } = req.body;
    if (!amount || !email) {
      return res.status(400).json({ success: false, message: 'amount and email are required' });
    }

    const user = await User.findById(req.user._id).select('+apiKeys.paystackKey');
    const secretKey = user?.apiKeys?.paystackKey || process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return res.status(400).json({ success: false, message: 'Paystack not configured. Add your secret key in Settings.' });
    }

    const reference = `MP_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(amount * 100), // Paystack uses kobo
        reference,
        callback_url: `${process.env.CLIENT_URL}/payment/verify`,
        metadata: { invoiceId, userId: req.user._id.toString(), description },
      },
      { headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' } }
    );

    // Create pending payment record
    await Payment.create({
      user: req.user._id,
      reference,
      amount,
      currency: 'NGN',
      method: 'paystack',
      status: 'pending',
      description,
      invoiceId: invoiceId || null,
      metadata: { email },
    });

    res.json({ success: true, data: response.data.data });
  } catch (err) {
    if (err.response?.data) {
      return res.status(400).json({ success: false, message: err.response.data.message });
    }
    next(err);
  }
};

// @route GET /api/payments/paystack/verify/:reference
exports.verifyPaystack = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const user = await User.findById(req.user._id).select('+apiKeys.paystackKey');
    const secretKey = user?.apiKeys?.paystackKey || process.env.PAYSTACK_SECRET_KEY;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );

    const txData = response.data.data;

    const payment = await Payment.findOneAndUpdate(
      { reference },
      {
        status: txData.status === 'success' ? 'success' : 'failed',
        paystackData: txData,
        paidAt: txData.status === 'success' ? new Date() : undefined,
      },
      { new: true }
    );

    // Mark invoice as paid if linked
    if (payment?.invoiceId && txData.status === 'success') {
      await Invoice.findByIdAndUpdate(payment.invoiceId, { status: 'paid', paidAt: new Date() });
    }

    res.json({ success: true, data: { status: txData.status, payment } });
  } catch (err) {
    if (err.response?.data) {
      return res.status(400).json({ success: false, message: err.response.data.message });
    }
    next(err);
  }
};

// @route POST /api/payments/paystack/webhook
exports.paystackWebhook = async (req, res, next) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const { event, data } = req.body;
    if (event === 'charge.success') {
      await Payment.findOneAndUpdate(
        { reference: data.reference },
        { status: 'success', paystackData: data, paidAt: new Date() }
      );
    }

    res.json({ success: true });
  } catch (err) { next(err); }
};

// @route GET /api/payments/bank-details
exports.getBankDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user.bankDetails || {} });
  } catch (err) { next(err); }
};

// @route GET /api/payments/history
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    const query = { user: req.user._id };
    if (status) query.status = status;

    const [payments, total] = await Promise.all([
      Payment.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('invoiceId', 'invoiceNumber client'),
      Payment.countDocuments(query),
    ]);
    res.json({ success: true, ...paginateResult(payments, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};
