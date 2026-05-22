const Contact = require('../models/Contact');
const { MessageLog, ScheduledMessage } = require('../models/Message');
const { sendMessage } = require('../services/messagingService');
const { paginateResult } = require('../middleware/paginate');
const schedule = require('node-schedule');
const User = require('../models/User');

// Store scheduled jobs in memory
const scheduledJobs = {};

// @route POST /api/messages/send
exports.sendNow = async (req, res, next) => {
  try {
    const { platform, content, contacts: contactIds } = req.body;
    if (!platform || !content || !contactIds?.length) {
      return res.status(400).json({ success: false, message: 'platform, content, and contacts are required' });
    }

    const user = await User.findById(req.user._id).select('+apiKeys.whatsappToken +apiKeys.facebookToken +apiKeys.instagramToken');
    const contacts = await Contact.find({ _id: { $in: contactIds }, user: req.user._id });

    const results = { sent: 0, failed: 0 };
    const logs = [];

    for (const contact of contacts) {
      const log = {
        user: req.user._id,
        contact: contact._id,
        contactName: contact.name,
        platform,
        content,
        status: 'pending',
      };
      try {
        const result = await sendMessage(platform, contact, content, user.apiKeys);
        log.status = 'sent';
        log.externalId = result?.messages?.[0]?.id || result?.messageId;
        results.sent++;
      } catch (err) {
        log.status = 'failed';
        log.error = err.message;
        results.failed++;
      }
      logs.push(log);
    }

    await MessageLog.insertMany(logs);
    res.json({ success: true, data: results, message: `Sent: ${results.sent}, Failed: ${results.failed}` });
  } catch (err) { next(err); }
};

// @route POST /api/messages/schedule
exports.scheduleMessage = async (req, res, next) => {
  try {
    const { platform, content, contacts: contactIds, scheduledAt, recurrence, templateId } = req.body;
    if (!platform || !content || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'platform, content, and scheduledAt are required' });
    }

    const scheduled = await ScheduledMessage.create({
      user: req.user._id,
      platform,
      content,
      contacts: contactIds || [],
      scheduledAt: new Date(scheduledAt),
      recurrence: recurrence || 'none',
      templateId,
      status: 'pending',
    });

    // Schedule the job
    scheduleJob(scheduled, req.user._id);

    res.status(201).json({ success: true, data: scheduled });
  } catch (err) { next(err); }
};

// Helper: schedule a job
const scheduleJob = (scheduledMsg, userId) => {
  const date = new Date(scheduledMsg.scheduledAt);
  if (date <= new Date()) return; // already past

  const job = schedule.scheduleJob(scheduledMsg._id.toString(), date, async () => {
    await executeScheduledMessage(scheduledMsg._id, userId);

    if (scheduledMsg.recurrence !== 'none') {
      const next = getNextRunDate(scheduledMsg.recurrence, date);
      await ScheduledMessage.findByIdAndUpdate(scheduledMsg._id, { scheduledAt: next, nextRunAt: next });
      const updated = await ScheduledMessage.findById(scheduledMsg._id);
      scheduleJob(updated, userId);
    }
  });

  scheduledJobs[scheduledMsg._id.toString()] = job;
};

const getNextRunDate = (recurrence, from) => {
  const d = new Date(from);
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
};

const executeScheduledMessage = async (scheduledMsgId, userId) => {
  try {
    const scheduledMsg = await ScheduledMessage.findById(scheduledMsgId);
    if (!scheduledMsg || scheduledMsg.status === 'cancelled') return;

    const user = await User.findById(userId).select('+apiKeys.whatsappToken +apiKeys.facebookToken +apiKeys.instagramToken');
    const contacts = await Contact.find({ _id: { $in: scheduledMsg.contacts }, isActive: true });

    const logs = [];
    for (const contact of contacts) {
      try {
        const result = await sendMessage(scheduledMsg.platform, contact, scheduledMsg.content, user?.apiKeys);
        logs.push({ user: userId, contact: contact._id, contactName: contact.name, platform: scheduledMsg.platform, content: scheduledMsg.content, status: 'sent', scheduledMessageId: scheduledMsgId });
      } catch (err) {
        logs.push({ user: userId, contact: contact._id, contactName: contact.name, platform: scheduledMsg.platform, content: scheduledMsg.content, status: 'failed', error: err.message, scheduledMessageId: scheduledMsgId });
      }
    }

    await MessageLog.insertMany(logs);
    const failed = logs.filter(l => l.status === 'failed').length;
    await ScheduledMessage.findByIdAndUpdate(scheduledMsgId, {
      status: scheduledMsg.recurrence === 'none' ? (failed === logs.length ? 'failed' : 'sent') : 'pending',
      lastRunAt: new Date(),
    });
  } catch (err) {
    console.error('Error executing scheduled message:', err);
  }
};

// Initialize scheduled jobs on server start
exports.initScheduledJobs = async () => {
  try {
    const pending = await ScheduledMessage.find({ status: 'pending', scheduledAt: { $gt: new Date() } });
    for (const msg of pending) {
      scheduleJob(msg, msg.user);
    }
    console.log(`✅ Initialized ${pending.length} scheduled message job(s)`);
  } catch (err) {
    console.error('Failed to init scheduled jobs:', err);
  }
};

// @route GET /api/messages/scheduled
exports.getScheduled = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const query = { user: req.user._id };
    const [messages, total] = await Promise.all([
      ScheduledMessage.find(query).sort({ scheduledAt: 1 }).skip(skip).limit(Number(limit)).populate('templateId', 'name'),
      ScheduledMessage.countDocuments(query),
    ]);
    res.json({ success: true, ...paginateResult(messages, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};

// @route DELETE /api/messages/scheduled/:id
exports.cancelScheduled = async (req, res, next) => {
  try {
    const msg = await ScheduledMessage.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status: 'cancelled' },
      { new: true }
    );
    if (!msg) return res.status(404).json({ success: false, message: 'Scheduled message not found' });
    // Cancel the in-memory job
    if (scheduledJobs[req.params.id]) {
      scheduledJobs[req.params.id].cancel();
      delete scheduledJobs[req.params.id];
    }
    res.json({ success: true, message: 'Scheduled message cancelled' });
  } catch (err) { next(err); }
};

// @route GET /api/messages/logs
exports.getLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, platform } = req.query;
    const skip = (page - 1) * limit;
    const query = { user: req.user._id };
    if (status) query.status = status;
    if (platform) query.platform = platform;

    const [logs, total] = await Promise.all([
      MessageLog.find(query).sort({ sentAt: -1 }).skip(skip).limit(Number(limit)).populate('contact', 'name company'),
      MessageLog.countDocuments(query),
    ]);
    res.json({ success: true, ...paginateResult(logs, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};
