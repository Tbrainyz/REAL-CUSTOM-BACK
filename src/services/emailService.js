const axios = require('axios');

// ─── Brevo REST API — direct axios call, no SDK ────────────────────────────────
// The @getbrevo/brevo SDK v5 has issues. We call the REST API directly.

exports.sendEmail = async (to, subject, htmlContent) => {
  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name:  process.env.BREVO_SENDER_NAME || 'My Real Customer App',
    },
    to: [{ email: to }],
    subject,
    htmlContent,
  };

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      payload,
      {
        headers: {
          'accept':       'application/json',
          'api-key':      process.env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        timeout: 10000,
      }
    );
    console.log(`📧 Email sent to ${to} — messageId: ${response.data?.messageId}`);
    return response.data;
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data || err.message;

    // Detailed error logging so you can debug from server logs
    console.error(`❌ Brevo email failed to ${to}`);
    console.error(`   Status : ${status}`);
    console.error(`   Message: ${JSON.stringify(message)}`);

    if (status === 403) {
      console.error('   ► FIX: Go to app.brevo.com → Security → remove IP allowlist restrictions on your API key');
    }
    if (status === 401) {
      console.error('   ► FIX: Check BREVO_API_KEY in your .env file');
    }
    if (status === 400) {
      console.error('   ► FIX: Sender email not verified in Brevo, or bad request payload');
    }

    throw err;
  }
};
