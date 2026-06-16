const { sendEmail } = require('../services/emailService');

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
