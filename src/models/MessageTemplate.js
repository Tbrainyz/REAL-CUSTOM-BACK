const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  platform: { type: String, enum: ['whatsapp', 'instagram', 'facebook', 'sms', 'all'], default: 'all' },
  variables: [{ type: String }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-extract variables like {{FirstName}}
templateSchema.pre('save', function (next) {
  const matches = this.content.match(/\{\{(\w+)\}\}/g) || [];
  this.variables = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  next();
});

module.exports = mongoose.model('MessageTemplate', templateSchema);
