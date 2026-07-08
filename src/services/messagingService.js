const axios       = require('axios');
const User        = require('../models/User');
const { sendEmail } = require('./emailService');

const META_API_VERSION = 'v22.0';

// ─── Personalize content ──────────────────────────────────────────────────────
const personalizeMessage = (content, contact) => {
  return content
    .replace(/\{\{FirstName\}\}/gi, contact.name?.split(' ')[0] || contact.name || '')
    .replace(/\{\{FullName\}\}/gi,  contact.name    || '')
    .replace(/\{\{Company\}\}/gi,   contact.company || '')
    .replace(/\{\{Phone\}\}/gi,     contact.phone   || '')
    .replace(/\{\{Email\}\}/gi,     contact.email   || '')
    .replace(/\{\{Date\}\}/gi,      new Date().toLocaleDateString());
};

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
const sendWhatsApp = async (to, message, userApiKeys) => {
  const token   = userApiKeys?.whatsappToken   || process.env.WHATSAPP_TOKEN;
  const phoneId = userApiKeys?.whatsappPhoneId || process.env.WHATSAPP_PHONE_ID;

  if (!token)   throw new Error('WhatsApp access token not configured. Add it in Settings → API Keys.');
  if (!phoneId) throw new Error('WhatsApp Phone Number ID not configured. Add it in Settings → API Keys.');

  const phone = to.replace(/[\s\-\(\)\+]/g, '');
  const url   = `https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`;

  try {
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      to:   phone,
      type: 'text',
      text: { body: message, preview_url: false },
    }, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    console.log(`✅ WhatsApp sent → ${phone}`);
    return response.data;
  } catch (err) {
    const metaError = err.response?.data?.error;
    const msg = metaError
      ? `WhatsApp API error: ${metaError.message} (code ${metaError.code})`
      : err.message;
    console.error(`❌ WhatsApp failed → ${phone}: ${JSON.stringify(metaError || err.message)}`);
    throw new Error(msg);
  }
};

// ─── Email via Brevo ──────────────────────────────────────────────────────────
const sendEmailMessage = async (contact, subject, htmlContent) => {
  if (!contact.email) throw new Error(`Contact "${contact.name}" has no email address`);

  // Wrap plain text in simple HTML if not already HTML
  const isHtml = htmlContent.trim().startsWith('<');
  const html   = isHtml
    ? htmlContent
    : `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333">
        ${htmlContent.replace(/\n/g, '<br>')}
       </div>`;

  return await sendEmail(contact.email, subject || 'Message from My Real Customer App', html);
};

// ─── Facebook ─────────────────────────────────────────────────────────────────
const sendFacebook = async (recipientId, message, userApiKeys) => {
  const token = userApiKeys?.facebookToken || process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) throw new Error('Facebook Page access token not configured.');

  const response = await axios.post(
    `https://graph.facebook.com/${META_API_VERSION}/me/messages`,
    { recipient: { id: recipientId }, message: { text: message } },
    { params: { access_token: token }, timeout: 15000 }
  );
  return response.data;
};

// ─── Instagram ────────────────────────────────────────────────────────────────
const sendInstagram = async (recipientId, message, userApiKeys) => {
  const token = userApiKeys?.instagramToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error('Instagram access token not configured.');

  const response = await axios.post(
    `https://graph.facebook.com/${META_API_VERSION}/me/messages`,
    { recipient: { id: recipientId }, message: { text: message } },
    { params: { access_token: token }, timeout: 15000 }
  );
  return response.data;
};

// ─── SMS placeholder ──────────────────────────────────────────────────────────
const sendSMS = async (phone, message) => {
  // Wire up Termii or any SMS provider here
  console.log(`[SMS] To: ${phone} | Message: ${message}`);
  return { messageId: `sms_${Date.now()}`, status: 'sent' };
};

// ─── Main dispatch ────────────────────────────────────────────────────────────
const sendMessage = async (platform, contact, content, userApiKeys) => {
  const text = personalizeMessage(content, contact);

  switch (platform) {
    case 'whatsapp': {
      const num = contact.whatsapp || contact.phone;
      if (!num) throw new Error(`Contact "${contact.name}" has no WhatsApp number`);
      return await sendWhatsApp(num, text, userApiKeys);
    }

    case 'email': {
      // For email, content can be "Subject | Body" separated by pipe, or just body
      const parts   = content.split('|');
      const subject = parts.length > 1 ? personalizeMessage(parts[0].trim(), contact) : 'Message from My Real Customer App';
      const body    = personalizeMessage(parts.length > 1 ? parts.slice(1).join('|').trim() : content, contact);
      return await sendEmailMessage(contact, subject, body);
    }

    case 'facebook':
      if (!contact.facebook) throw new Error(`Contact "${contact.name}" has no Facebook ID`);
      return await sendFacebook(contact.facebook, text, userApiKeys);

    case 'instagram':
      if (!contact.instagram) throw new Error(`Contact "${contact.name}" has no Instagram handle`);
      return await sendInstagram(contact.instagram, text, userApiKeys);

    case 'sms': {
      const num = contact.phone || contact.whatsapp;
      if (!num) throw new Error(`Contact "${contact.name}" has no phone number`);
      return await sendSMS(num, text);
    }

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

module.exports = { sendMessage, sendWhatsApp, personalizeMessage };
