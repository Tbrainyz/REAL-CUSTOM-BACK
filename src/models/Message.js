const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  contactName: String, // snapshot
  platform: { type: String, enum: ['whatsapp', 'instagram', 'facebook', 'sms'], required: true },
  content: { type: String, required: true },
  status: { type: String, enum: ['sent', 'pending', 'failed'], default: 'pending' },
  error: { type: String },
  externalId: { type: String }, // ID from WhatsApp/FB API
  sentAt: { type: Date, default: Date.now },
  scheduledMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledMessage' },
}, { timestamps: true });

messageLogSchema.index({ user: 1, status: 1 });
messageLogSchema.index({ user: 1, platform: 1 });
messageLogSchema.index({ user: 1, sentAt: -1 });

const scheduledMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate' },
  content: { type: String, required: true },
  platform: { type: String, enum: ['whatsapp', 'instagram', 'facebook', 'sms'], required: true },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
  scheduledAt: { type: Date, required: true },
  recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  status: { type: String, enum: ['pending', 'sent', 'failed', 'cancelled'], default: 'pending' },
  lastRunAt: { type: Date },
  nextRunAt: { type: Date },
  jobId: { type: String }, // node-schedule job id
}, { timestamps: true });

scheduledMessageSchema.index({ user: 1, status: 1 });
scheduledMessageSchema.index({ scheduledAt: 1, status: 1 });

const MessageLog = mongoose.model('MessageLog', messageLogSchema);
const ScheduledMessage = mongoose.model('ScheduledMessage', scheduledMessageSchema);

module.exports = { MessageLog, ScheduledMessage };
