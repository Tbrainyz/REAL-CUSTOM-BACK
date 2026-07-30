const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

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

// ─── Send email (with optional attachments) ───────────────────────────────────
// attachments: array of { filename, content (base64), type }
// OR array of file paths (strings)
exports.sendEmail = async (to, subject, htmlContent, attachments = []) => {
  if (!process.env.BREVO_API_KEY)      throw new Error('BREVO_API_KEY not set');
  if (!process.env.BREVO_SENDER_EMAIL) throw new Error('BREVO_SENDER_EMAIL not set');

  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name:  process.env.BREVO_SENDER_NAME || 'My Real Customer App',
    },
    to:      [{ email: to }],
    subject,
    htmlContent,
  };

  // Process attachments
  if (attachments && attachments.length > 0) {
    payload.attachment = attachments.map(att => {
      // If it's a file path string
      if (typeof att === 'string') {
        const fileContent = fs.readFileSync(att);
        return {
          name:    path.basename(att),
          content: fileContent.toString('base64'),
        };
      }
      // If it's already an object { filename, content, type }
      return {
        name:    att.filename || att.name || 'attachment',
        content: att.content,  // must be base64
      };
    });
  }

  console.log(`📤 Sending email → ${to} | "${subject}" | ${attachments.length} attachment(s)`);

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
        timeout: 20000,
      }
    );
    console.log(`✅ Email sent to ${to} — messageId: ${response.data?.messageId}`);
    return response.data;
  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data;
    console.error(`❌ Email FAILED → ${to} | Status: ${status} | ${JSON.stringify(data)}`);
    if (status === 403) console.error('   FIX: Remove IP restrictions on Brevo API key');
    if (status === 401) console.error('   FIX: Invalid Brevo API key');
    if (status === 400) console.error('   FIX: Bad request —', JSON.stringify(data));
    throw err;
  }
};
