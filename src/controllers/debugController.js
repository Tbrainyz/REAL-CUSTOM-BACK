const axios = require('axios');

exports.testEmail = async (req, res) => {
  res.json({ success: false, message: 'Email test not available in this version' });
};

exports.testWhatsApp = async (req, res) => {
  // Set response header immediately so it never returns empty
  res.setHeader('Content-Type', 'application/json');

  const { to, message } = req.body || {};

  if (!to) {
    return res.status(400).json({ success: false, message: 'Provide "to" phone number' });
  }

  // Read directly from env — no DB calls, no crashes
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  const envCheck = {
    WHATSAPP_TOKEN_set:    !!token,
    WHATSAPP_TOKEN_prefix: token ? token.slice(0, 25) + '...' : 'NOT SET ❌',
    WHATSAPP_PHONE_ID:     phoneId || 'NOT SET ❌',
  };

  if (!token) {
    return res.status(500).json({
      success: false,
      message: 'WHATSAPP_TOKEN is not set in Render environment variables',
      envCheck,
    });
  }

  if (!phoneId) {
    return res.status(500).json({
      success: false,
      message: 'WHATSAPP_PHONE_ID is not set in Render environment variables',
      envCheck,
    });
  }

  // Normalize phone number
  const phone = to.replace(/[\s\-\(\)\+]/g, '');
  const url   = `https://graph.facebook.com/v22.0/${phoneId}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to:   phone,
        type: 'text',
        text: { body: message || 'Test from My Real Customer App ✅', preview_url: false },
      },
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    console.log(`✅ WhatsApp sent to ${phone}`);
    return res.json({
      success:  true,
      message:  `WhatsApp message sent to ${phone}`,
      result:   response.data,
      envCheck,
    });

  } catch (err) {
    const metaError = err.response?.data?.error;
    console.error(`❌ WhatsApp failed: ${JSON.stringify(metaError || err.message)}`);
    return res.status(500).json({
      success:  false,
      message:  'WhatsApp send failed',
      error:    metaError || err.message,
      envCheck,
      hint: metaError?.code === 190
        ? 'Token expired — generate a new one from Meta → WhatsApp → Step 1 Try it out → Generate token → update WHATSAPP_TOKEN on Render'
        : metaError?.code === 131030
          ? 'Recipient not in test list — add your number at Meta → WhatsApp → Step 1 → Recipient dropdown → Add number'
          : 'Check Render logs for details',
    });
  }
};
