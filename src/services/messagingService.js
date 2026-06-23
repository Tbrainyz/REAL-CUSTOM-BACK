const axios = require('axios');
const User  = require('../models/User');

// Meta Graph API version — update here if Meta deprecates this version
const META_API_VERSION = 'v22.0';

// ─── Personalize message content with contact data ────────────────────────────
const personalizeMessage = (content, contact) => {
  return content
    .replace(/\{\{FirstName\}\}/gi, contact.name?.split(' ')[0] || contact.name)
    .replace(/\{\{FullName\}\}/gi,  contact.name || '')
    .replace(/\{\{Company\}\}/gi,   contact.company || '')
    .replace(/\{\{Phone\}\}/gi,     contact.phone || '')
    .replace(/\{\{Email\}\}/gi,     contact.email || '')
    .replace(/\{\{Date\}\}/gi,      new Date().toLocaleDateString());
};

// ─── Send WhatsApp message via Meta Cloud API ─────────────────────────────────
const sendWhatsApp = async (to, message, userApiKeys) => {
  const token   = userApiKeys?.whatsappToken   || process.env.WHATSAPP_TOKEN;
  const phoneId = userApiKeys?.whatsappPhoneId || process.env.WHATSAPP_PHONE_ID;

  if (!token)   throw new Error('WhatsApp access token not configured. Add it in Settings → API Keys.');
  if (!phoneId) throw new Error('WhatsApp Phone Number ID not configured. Add it in Settings → API Keys.');

  // Normalize phone number — strip spaces, dashes, parens, leading +
  const phone = to.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');

  const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message, preview_url: false },
      },
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    console.log(`✅ WhatsApp sent → ${phone} | messageId: ${response.data?.messages?.[0]?.id}`);
    return response.data;
  } catch (err) {
    const metaError = err.response?.data?.error;
    const errMsg = metaError
      ? `WhatsApp API error: ${metaError.message} (code ${metaError.code}${metaError.error_subcode ? '/' + metaError.error_subcode : ''})`
      : err.message;

    console.error(`❌ WhatsApp send failed → ${phone}`);
    console.error(`   URL: ${url}`);
    console.error(`   Error: ${JSON.stringify(metaError || err.message)}`);

    // Helpful hints for common Meta errors
    if (metaError?.code === 190) {
      console.error('   ► FIX: Access token expired or invalid. Generate a new token in Meta Business Suite.');
    }
    if (metaError?.code === 100 && metaError?.error_subcode === 33) {
      console.error('   ► FIX: Phone Number ID is wrong, or token does not have access to this number.');
    }
    if (metaError?.code === 131030) {
      console.error('   ► FIX: Recipient phone number is not in your allowed test numbers list (sandbox mode).');
    }
    if (metaError?.code === 131047) {
      console.error('   ► FIX: 24-hour customer service window expired. Use an approved template message instead.');
    }

    throw new Error(errMsg);
  }
};

// ─── Send WhatsApp Template message (required outside 24hr window) ────────────
const sendWhatsAppTemplate = async (to, templateName, languageCode = 'en_US', components = [], userApiKeys) => {
  const token   = userApiKeys?.whatsappToken   || process.env.WHATSAPP_TOKEN;
  const phoneId = userApiKeys?.whatsappPhoneId || process.env.WHATSAPP_PHONE_ID;

  if (!token)   throw new Error('WhatsApp access token not configured.');
  if (!phoneId) throw new Error('WhatsApp Phone Number ID not configured.');

  const phone = to.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
  const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`;

  const response = await axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  return response.data;
};

// ─── Send Facebook Messenger message ──────────────────────────────────────────
const sendFacebook = async (recipientId, message, userApiKeys) => {
  const token = userApiKeys?.facebookToken || process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) throw new Error('Facebook Page access token not configured. Add it in Settings → API Keys.');

  const url = `https://graph.facebook.com/${META_API_VERSION}/me/messages`;

  try {
    const response = await axios.post(
      url,
      { recipient: { id: recipientId }, message: { text: message } },
      { params: { access_token: token }, timeout: 15000 }
    );
    return response.data;
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw new Error(metaError ? `Facebook API error: ${metaError.message}` : err.message);
  }
};

// ─── Send Instagram DM ────────────────────────────────────────────────────────
const sendInstagram = async (recipientId, message, userApiKeys) => {
  const token = userApiKeys?.instagramToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error('Instagram access token not configured. Add it in Settings → API Keys.');

  const url = `https://graph.facebook.com/${META_API_VERSION}/me/messages`;

  try {
    const response = await axios.post(
      url,
      { recipient: { id: recipientId }, message: { text: message } },
      { params: { access_token: token }, timeout: 15000 }
    );
    return response.data;
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw new Error(metaError ? `Instagram API error: ${metaError.message}` : err.message);
  }
};

// ─── Send SMS (placeholder — wire up Termii/Twilio when ready) ────────────────
const sendSMS = async (phone, message) => {
  console.log(`[SMS placeholder] To: ${phone} | Message: ${message}`);
  return { messageId: `sms_${Date.now()}` };
};

// ─── Main dispatch ─────────────────────────────────────────────────────────────
const sendMessage = async (platform, contact, content, userApiKeys) => {
  const personalizedContent = personalizeMessage(content, contact);

  switch (platform) {
    case 'whatsapp': {
      const waNumber = contact.whatsapp || contact.phone;
      if (!waNumber) throw new Error('No WhatsApp number for this contact');
      return await sendWhatsApp(waNumber, personalizedContent, userApiKeys);
    }
    case 'facebook':
      if (!contact.facebook) throw new Error('No Facebook ID for this contact');
      return await sendFacebook(contact.facebook, personalizedContent, userApiKeys);

    case 'instagram':
      if (!contact.instagram) throw new Error('No Instagram handle for this contact');
      return await sendInstagram(contact.instagram, personalizedContent, userApiKeys);

    case 'sms': {
      const smsNumber = contact.phone || contact.whatsapp;
      if (!smsNumber) throw new Error('No phone number for this contact');
      return await sendSMS(smsNumber, personalizedContent);
    }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

module.exports = { sendMessage, sendWhatsApp, sendWhatsAppTemplate, personalizeMessage };
