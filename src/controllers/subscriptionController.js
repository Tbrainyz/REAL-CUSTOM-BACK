const axios = require('axios');
const User  = require('../models/User');
const { sendEmail } = require('../services/emailService');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

// ─── GET /subscription/status ─────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    data: {
      status:       user.subscription?.status  || 'trial',
      plan:         user.subscription?.plan    || null,
      billing:      user.subscription?.billing || null,
      trialEndsAt:  user.subscription?.trialEndsAt || null,
      trialDaysLeft: user.trialDaysLeft,
      hasAccess:    user.hasAccess,
      bypassTrial:  user.bypassTrial,
      currentPeriodEnd: user.subscription?.currentPeriodEnd || null,
    },
  });
};

// ─── POST /subscription/activate ─────────────────────────────────────────────
// Called after successful Paystack payment on the pricing page.
// Verifies the payment with Paystack then activates the subscription.
exports.activate = async (req, res, next) => {
  try {
    const { reference, plan, billing } = req.body;

    if (!reference || !plan || !billing) {
      return res.status(400).json({ success: false, message: 'reference, plan and billing are required' });
    }

    // Verify payment with Paystack
    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: paystackHeaders() }
    );

    const txn = response.data.data;
    if (txn.status !== 'success') {
      return res.status(400).json({ success: false, message: `Payment not confirmed. Status: ${txn.status}` });
    }

    // Calculate expiry
    const now = new Date();
    const currentPeriodEnd = billing === 'yearly'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        'subscription.status':           'active',
        'subscription.plan':             plan,
        'subscription.billing':          billing,
        'subscription.paystackReference': reference,
        'subscription.subscribedAt':     now,
        'subscription.currentPeriodEnd': currentPeriodEnd,
        'subscription.trialEndsAt':      undefined,
      },
      { new: true }
    );

    // Send confirmation email
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;background:#f9f9f9">
        <div style="background:white;border-radius:12px;padding:30px;border:1px solid #e5e7eb">
          <div style="text-align:center;margin-bottom:24px">
            <div style="width:60px;height:60px;background:#4F46E5;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
              <span style="color:white;font-size:28px">✓</span>
            </div>
            <h2 style="color:#4F46E5;margin:0">Subscription Activated!</h2>
          </div>
          <p>Hi <strong>${user.name}</strong>, welcome aboard!</p>
          <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:20px 0">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#6b7280;padding:6px 0">Plan</td><td style="font-weight:600;text-align:right">${plan}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0">Billing</td><td style="font-weight:600;text-align:right;text-transform:capitalize">${billing}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0">Next renewal</td><td style="font-weight:600;text-align:right">${currentPeriodEnd.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0">Reference</td><td style="font-weight:600;text-align:right;font-size:12px">${reference}</td></tr>
            </table>
          </div>
          <p>You now have full access to all features on your <strong>${plan}</strong> plan.</p>
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard"
            style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#6366F1);color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">
            Go to Dashboard →
          </a>
        </div>
      </div>`;

    sendEmail(user.email, `Subscription Confirmed — ${plan} Plan`, html)
      .catch(err => console.warn('Subscription email failed:', err.message));

    res.json({ success: true, message: 'Subscription activated', data: { plan, billing, currentPeriodEnd } });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('Subscription activate error:', msg);
    next(err);
  }
};

// ─── POST /subscription/bypass (DEV ONLY) ─────────────────────────────────────
// Lets you set bypassTrial on your own account via a secret key.
// Remove this endpoint before going to production.
exports.devBypass = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Not available in production' });
  }
  const { secret } = req.body;
  if (secret !== process.env.DEV_BYPASS_SECRET) {
    return res.status(403).json({ success: false, message: 'Invalid secret' });
  }
  await User.findByIdAndUpdate(req.user._id, { bypassTrial: true });
  res.json({ success: true, message: 'Trial bypass enabled on your account. You will never be blocked.' });
};
