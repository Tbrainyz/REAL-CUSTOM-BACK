const { sendEmail } = require('../services/emailService');
const { sendWhatsApp } = require('../services/messagingService');

exports.testEmail = async (req, res) => {
  const to = req.body?.to || req.user?.email;
  if (!to) return res.status(400).json({ success: false, message: 'Provide "to" email in body' });

  const envCheck = {
    BREVO_API_KEY_set:    !!process.env.BREVO_API_KEY,
    BREVO_API_KEY_prefix: process.env.BREVO_API_KEY?.slice(0, 12) + '...',
    BREVO_SENDER_EMAIL:   process.env.BREVO_SENDER_EMAIL || null,
    BREVO_SENDER_NAME:    process.env.BREVO_SENDER_NAME  || null,
    NODE_ENV:             process.env.NODE_ENV || null,
  };

  try {
    const result = await sendEmail(to, 'Test Email — My Real Customer App',
      `<div style="font-family:Arial,sans-serif;padding:20px">
        <h2 style="color:#4F46E5">✅ Email Working!</h2>
        <p>If you see this, Brevo is configured correctly.</p>
        <p>Sent: ${new Date().toISOString()}</p>
      </div>`
    );
    res.json({ success: true, message: `Email sent to ${to}`, result, envCheck });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Email failed', error: { status: err.response?.status, data: err.response?.data, message: err.message }, envCheck });
  }
};

// ─── POST /debug/test-whatsapp (admin only) ───────────────────────────────────
// Sends a test WhatsApp message using either your saved API keys (Settings)
// or the .env fallback, and returns the FULL Meta API response/error.
exports.testWhatsApp = async (req, res) => {
  const { to, message } = req.body;

  if (!to) {
    return res.status(400).json({ success: false, message: 'Provide "to" phone number in body, e.g. { "to": "2348012345678" }' });
  }

  const envCheck = {
    WHATSAPP_TOKEN_set:    !!process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_ID_env: process.env.WHATSAPP_PHONE_ID || null,
    user_whatsappToken_set:    !!req.user?.apiKeys?.whatsappToken,
    user_whatsappPhoneId:      req.user?.apiKeys?.whatsappPhoneId || null,
    effective_phoneId: req.user?.apiKeys?.whatsappPhoneId || process.env.WHATSAPP_PHONE_ID || null,
  };

  try {
    const result = await sendWhatsApp(
      to,
      message || 'Test message from My Real Customer App ✅',
      req.user?.apiKeys
    );
    res.json({ success: true, message: `WhatsApp message sent to ${to}`, result, envCheck });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'WhatsApp send failed — see details below',
      error: err.message,
      envCheck,
    });
  }
};
