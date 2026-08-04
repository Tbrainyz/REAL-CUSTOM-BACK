const axios         = require('axios');
const { sendEmail } = require('./emailService');

const META_API_VERSION = 'v22.0';

// ─── Personalize content ──────────────────────────────────────────────────────
const personalizeMessage = (content, contact) => {
  return content
    .replace(/\{\{FirstName\}\}/gi, contact.name?.split(' ')[0] || '')
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

  if (!token)   throw new Error('WhatsApp access token not configured.');
  if (!phoneId) throw new Error('WhatsApp Phone Number ID not configured.');

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
    console.log(`✅ WhatsApp sent to ${phone}`);
    return response.data;
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw new Error(metaError
      ? `WhatsApp error: ${metaError.message} (code ${metaError.code})`
      : err.message
    );
  }
};

// ─── SMS via SmartSMS Solutions ───────────────────────────────────────────────
const sendSMS = async (phone, message, userApiKeys) => {
  const token    = userApiKeys?.smartsmsToken    || process.env.SMARTSMS_TOKEN;
  const senderId = userApiKeys?.smartsmsSenderId || process.env.SMARTSMS_SENDER_ID;

  if (!token)    throw new Error('SmartSMS token not set. Add SMARTSMS_TOKEN to Render environment.');
  if (!senderId) throw new Error('SmartSMS Sender ID not set. Add SMARTSMS_SENDER_ID to Render environment.');

  // Normalize phone to international format: 08012345678 → 2348012345678
  let normalized = phone.replace(/[\s\-\(\)\+]/g, '');
  if (normalized.startsWith('0')) {
    normalized = '234' + normalized.slice(1);
  }

  console.log(`📱 Sending SMS via SmartSMS to ${normalized} from ${senderId}`);

  try {
    const params = new URLSearchParams({
      token:   token,
      sender:  senderId,
      to:      normalized,
      message: message,
      type:    '0',   // 0 = plain text
      routing: '3',   // 3 = corporate route (bypasses DND)
    });

    const response = await axios.post(
      'https://app.smartsmssolutions.com/io/api/client/v1/sms/',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    const data = response.data;
    console.log(`SmartSMS response:`, JSON.stringify(data));

    // SmartSMS returns code 1000 for success
    const code = String(data?.code);
    if (code === '1000' || data?.state === 'success') {
      console.log(`✅ SMS sent to ${normalized}`);
      return { messageId: data?.messageid || `sms_${Date.now()}`, status: 'sent', raw: data };
    } else {
      throw new Error(data?.message || data?.Message || `SmartSMS error code: ${code}`);
    }
  } catch (err) {
    const errMsg = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`❌ SMS failed to ${normalized}: ${errMsg}`);
    throw new Error(`SMS failed: ${errMsg}`);
  }
};

// ─── Email via Brevo ──────────────────────────────────────────────────────────
const sendEmailMessage = async (contact, subject, htmlContent, attachments = []) => {
  if (!contact.email) throw new Error(`Contact "${contact.name}" has no email address`);
  const isHtml = htmlContent.trim().startsWith('<');
  const html   = isHtml
    ? htmlContent
    : `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333">
        ${htmlContent.replace(/\n/g, '<br>')}
       </div>`;
  return await sendEmail(contact.email, subject || 'Message from My Real Customer App', html, attachments);
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

// ─── Main dispatch ────────────────────────────────────────────────────────────
const sendMessage = async (platform, contact, content, userApiKeys, options = {}) => {
  const text = personalizeMessage(content, contact);

  switch (platform) {
    case 'whatsapp': {
      const num = contact.whatsapp || contact.phone;
      if (!num) throw new Error(`Contact "${contact.name}" has no WhatsApp number`);
      return await sendWhatsApp(num, text, userApiKeys);
    }

    case 'sms': {
      const num = contact.phone || contact.whatsapp;
      if (!num) throw new Error(`Contact "${contact.name}" has no phone number`);
      return await sendSMS(num, text, userApiKeys);
    }

    case 'email': {
      const parts   = content.split('|');
      const subject = parts.length > 1 ? personalizeMessage(parts[0].trim(), contact) : 'Message from My Real Customer App';
      const body    = personalizeMessage(parts.length > 1 ? parts.slice(1).join('|').trim() : content, contact);
      return await sendEmailMessage(contact, subject, body, options?.attachments || []);
    }

    case 'facebook':
      if (!contact.facebook) throw new Error(`Contact "${contact.name}" has no Facebook ID`);
      return await sendFacebook(contact.facebook, text, userApiKeys);

    case 'instagram':
      if (!contact.instagram) throw new Error(`Contact "${contact.name}" has no Instagram handle`);
      return await sendInstagram(contact.instagram, text, userApiKeys);

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};


// ─── Sender ID helpers ─────────────────────────────────────────────────────────
// SmartSMS Sender IDs: max 11 chars, alphanumeric only, no spaces/symbols.
const sanitizeSenderId = (text) => {
  if (!text) return '';
  return text
    .replace(/[^a-zA-Z0-9]/g, '')   // strip everything except letters/numbers
    .slice(0, 11)                    // max 11 chars
    .toUpperCase();
};

// Submit a Sender ID to SmartSMS for whitelisting/approval
const submitSenderId = async ({ token, senderId, organisation, regno, address, sampleMessage }) => {
  if (!token)        throw new Error('SmartSMS token is required');
  if (!senderId)      throw new Error('Sender ID is required');
  if (!organisation)  throw new Error('Organisation name is required');
  if (!regno)          throw new Error('CAC registration number is required');
  if (!address)        throw new Error('Business address is required');

  const FormData = require('form-data');
  const form = new FormData();
  form.append('token',        token);
  form.append('senderid',     senderId);
  form.append('message',      sampleMessage || `Sample message from ${organisation}`);
  form.append('organisation', organisation);
  form.append('regno',        regno);
  form.append('address',      address);

  try {
    const response = await axios.post(
      'https://app.smartsmssolutions.com/io/api/client/v1/senderid/create/',
      form,
      { headers: form.getHeaders(), timeout: 20000 }
    );
    console.log('Sender ID submission response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('Sender ID submission failed:', errMsg);
    throw new Error(`Sender ID submission failed: ${errMsg}`);
  }
};

module.exports = { sendMessage, sendWhatsApp, sendSMS, personalizeMessage, sanitizeSenderId, submitSenderId };
