const axios = require('axios');
const User = require('../models/User');

// Personalize message content with contact data
const personalizeMessage = (content, contact) => {
  return content
    .replace(/\{\{FirstName\}\}/gi, contact.name?.split(' ')[0] || contact.name)
    .replace(/\{\{FullName\}\}/gi, contact.name || '')
    .replace(/\{\{Company\}\}/gi, contact.company || '')
    .replace(/\{\{Phone\}\}/gi, contact.phone || '')
    .replace(/\{\{Email\}\}/gi, contact.email || '')
    .replace(/\{\{Date\}\}/gi, new Date().toLocaleDateString());
};

// Send WhatsApp message via Meta Business API
const sendWhatsApp = async (to, message, userApiKeys) => {
  const token = userApiKeys?.whatsappToken || process.env.WHATSAPP_TOKEN;
  const phoneId = userApiKeys?.whatsappPhoneId || process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) throw new Error('WhatsApp API not configured');

  // Normalize phone number
  const phone = to.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');

  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

// Send Facebook Messenger message
const sendFacebook = async (recipientId, message, userApiKeys) => {
  const token = userApiKeys?.facebookToken || process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) throw new Error('Facebook API not configured');

  const response = await axios.post(
    `https://graph.facebook.com/v18.0/me/messages`,
    {
      recipient: { id: recipientId },
      message: { text: message },
    },
    { params: { access_token: token } }
  );
  return response.data;
};

// Send Instagram DM
const sendInstagram = async (recipientId, message, userApiKeys) => {
  const token = userApiKeys?.instagramToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error('Instagram API not configured');

  const response = await axios.post(
    `https://graph.facebook.com/v18.0/me/messages`,
    {
      recipient: { id: recipientId },
      message: { text: message },
    },
    { params: { access_token: token } }
  );
  return response.data;
};

// Send SMS (placeholder – integrate with your SMS provider e.g. Termii, Twilio)
const sendSMS = async (phone, message) => {
  // Example: Termii SMS API
  // const response = await axios.post('https://api.ng.termii.com/api/sms/send', { to: phone, from: 'YourBrand', sms: message, type: 'plain', channel: 'generic', api_key: process.env.TERMII_API_KEY });
  // Placeholder: simulate success
  console.log(`[SMS] To: ${phone} | Message: ${message}`);
  return { messageId: `sms_${Date.now()}` };
};

// Main dispatch function
const sendMessage = async (platform, contact, content, userApiKeys) => {
  const personalizedContent = personalizeMessage(content, contact);

  switch (platform) {
    case 'whatsapp':
      const waNumber = contact.whatsapp || contact.phone;
      if (!waNumber) throw new Error('No WhatsApp number for this contact');
      return await sendWhatsApp(waNumber, personalizedContent, userApiKeys);

    case 'facebook':
      if (!contact.facebook) throw new Error('No Facebook ID for this contact');
      return await sendFacebook(contact.facebook, personalizedContent, userApiKeys);

    case 'instagram':
      if (!contact.instagram) throw new Error('No Instagram handle for this contact');
      return await sendInstagram(contact.instagram, personalizedContent, userApiKeys);

    case 'sms':
      const smsNumber = contact.phone || contact.whatsapp;
      if (!smsNumber) throw new Error('No phone number for this contact');
      return await sendSMS(smsNumber, personalizedContent);

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

module.exports = { sendMessage, personalizeMessage };
