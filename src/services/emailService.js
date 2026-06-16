const axios = require('axios');

(function logStartupCheck() {
  const hasKey    = !!process.env.BREVO_API_KEY;
  const hasSender = !!process.env.BREVO_SENDER_EMAIL;
  console.log('───────────────────────────────────────────');
  console.log('📧 Email Service (Brevo) — Startup Check');
  console.log(`   BREVO_API_KEY      : ${hasKey ? '✅ set (' + process.env.BREVO_API_KEY.slice(0, 10) + '...)' : '❌ MISSING'}`);
  console.log(`   BREVO_SENDER_EMAIL : ${hasSender ? '✅ ' + process.env.BREVO_SENDER_EMAIL : '❌ MISSING'}`);
  if (!hasKey || !hasSender) {
    console.log('   ⚠️  Emails will fail — set these in Render → Environment Variables.');
  }
  console.log('───────────────────────────────────────────');
})();

exports.sendEmail = async (to, subject, htmlContent) => {
  if (!process.env.BREVO_API_KEY)     throw new Error('BREVO_API_KEY not set');
  if (!process.env.BREVO_SENDER_EMAIL) throw new Error('BREVO_SENDER_EMAIL not set');

  const payload = {
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'My Real Customer App' },
    to:     [{ email: to }],
    subject,
    htmlContent,
  };

  console.log(`📤 Sending email → ${to} | "${subject}"`);

  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: { 'accept': 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
      timeout: 15000,
    });
    console.log(`✅ Email sent to ${to} — messageId: ${response.data?.messageId}`);
    return response.data;
  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data;
    console.error(`❌ Email FAILED to ${to} | Status: ${status} | ${JSON.stringify(data)} | ${err.message}`);
    if (status === 403) console.error('   FIX: Remove IP restrictions on your Brevo API key (app.brevo.com → SMTP & API → API Keys)');
    if (status === 401) console.error('   FIX: Invalid Brevo API key — regenerate in Brevo dashboard and update BREVO_API_KEY on Render');
    if (status === 400) console.error('   FIX: Sender email not verified — check Brevo → Senders, Domains, IPs');
    throw err;
  }
};
