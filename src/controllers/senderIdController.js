const User = require('../models/User');
const { sanitizeSenderId, submitSenderId } = require('../services/messagingService');

// ─── GET /sender-id/suggest ────────────────────────────────────────────────────
// Auto-generates a valid Sender ID suggestion from the admin's business/company name.
exports.suggest = async (req, res) => {
  const businessName = req.user?.settings?.businessName || req.user?.name || '';
  const suggested = sanitizeSenderId(businessName);

  res.json({
    success: true,
    data: {
      suggested,
      source: req.user?.settings?.businessName ? 'businessName' : 'adminName',
      rules: 'Max 11 characters, letters and numbers only, no spaces.',
    },
  });
};

// ─── GET /sender-id/status ─────────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    success: true,
    data: {
      senderId:     user.apiKeys?.smartsmsSenderId     || null,
      status:       user.apiKeys?.smartsmsSenderIdStatus || 'not_submitted',
      submittedAt:  user.apiKeys?.smartsmsSubmittedAt    || null,
    },
  });
};

// ─── POST /sender-id/submit ─────────────────────────────────────────────────────
// Submits the chosen Sender ID to SmartSMS for whitelisting/approval.
exports.submit = async (req, res, next) => {
  try {
    let { senderId, organisation, regno, address, sampleMessage } = req.body;

    // Fall back to saved business settings if not explicitly provided
    const savedSettings = req.user?.settings || {};
    organisation = organisation || savedSettings.businessName;
    regno        = regno        || savedSettings.cacRegNumber;
    address      = address      || savedSettings.businessAddress;

    if (!senderId)     return res.status(400).json({ success: false, message: 'Sender ID is required' });
    if (!organisation) return res.status(400).json({ success: false, message: 'Organisation/company name is required (set it in Settings → Business, or pass it directly)' });
    if (!regno)         return res.status(400).json({ success: false, message: 'CAC registration number is required (set it in Settings → Business, or pass it directly)' });
    if (!address)       return res.status(400).json({ success: false, message: 'Business address is required (set it in Settings → Business, or pass it directly)' });

    const cleanSenderId = sanitizeSenderId(senderId);
    if (cleanSenderId.length < 3) {
      return res.status(400).json({ success: false, message: 'Sender ID must be at least 3 characters (letters/numbers only)' });
    }

    // Get user's SmartSMS token
    const user = await User.findById(req.user._id).select('+apiKeys.smartsmsToken');
    const token = user.apiKeys?.smartsmsToken || process.env.SMARTSMS_TOKEN;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Add your SmartSMS API token first (Settings → API Keys) before submitting a Sender ID.',
      });
    }

    // Submit to SmartSMS
    const result = await submitSenderId({
      token,
      senderId:     cleanSenderId,
      organisation,
      regno,
      address,
      sampleMessage,
    });

    // Save the submission state on the user
    await User.findByIdAndUpdate(req.user._id, {
      'apiKeys.smartsmsSenderId':       cleanSenderId,
      'apiKeys.smartsmsSenderIdStatus': 'pending',
      'apiKeys.smartsmsSubmittedAt':    new Date(),
    });

    res.json({
      success: true,
      message: `Sender ID "${cleanSenderId}" submitted for approval. This typically takes 24-48 hours.`,
      data: result,
    });

  } catch (err) {
    console.error('Sender ID submit error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
