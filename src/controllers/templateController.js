const MessageTemplate = require('../models/MessageTemplate');
const { paginateResult } = require('../middleware/paginate');

exports.getTemplates = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, platform } = req.query;
    const skip = (page - 1) * limit;
    const query = { user: req.user._id, isActive: true };
    if (platform) query.platform = { $in: [platform, 'all'] };

    const [templates, total] = await Promise.all([
      MessageTemplate.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      MessageTemplate.countDocuments(query),
    ]);
    res.json({ success: true, ...paginateResult(templates, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};

exports.getTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.findOne({ _id: req.params.id, user: req.user._id });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
};

exports.updateTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
};
