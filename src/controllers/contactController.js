const Contact = require('../models/Contact');
const { paginateResult } = require('../middleware/paginate');
const csv = require('csv-parser');
const fs = require('fs');

// @route GET /api/contacts
exports.getContacts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, segment, tags } = req.query;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id, isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    if (segment) query.segment = segment;
    if (tags) query.tags = { $in: tags.split(',') };

    const [contacts, total] = await Promise.all([
      Contact.find(query).sort({ name: 1 }).skip(skip).limit(Number(limit)),
      Contact.countDocuments(query),
    ]);

    res.json({ success: true, ...paginateResult(contacts, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};

// @route GET /api/contacts/:id
exports.getContact = async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, user: req.user._id });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, data: contact });
  } catch (err) { next(err); }
};

// @route POST /api/contacts
exports.createContact = async (req, res, next) => {
  try {
    const contact = await Contact.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, data: contact });
  } catch (err) { next(err); }
};

// @route PUT /api/contacts/:id
exports.updateContact = async (req, res, next) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, data: contact });
  } catch (err) { next(err); }
};

// @route DELETE /api/contacts/:id
exports.deleteContact = async (req, res, next) => {
  try {
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) { next(err); }
};

// @route POST /api/contacts/import
exports.importContacts = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const contacts = [];
    const errors = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          const contact = {
            user: req.user._id,
            name: row.name || row.Name || row.full_name || '',
            company: row.company || row.Company || '',
            email: row.email || row.Email || '',
            phone: row.phone || row.Phone || row.mobile || '',
            whatsapp: row.whatsapp || row.WhatsApp || row.whatsapp_number || '',
            facebook: row.facebook || row.Facebook || '',
            instagram: row.instagram || row.Instagram || '',
            tiktok: row.tiktok || row.TikTok || '',
            segment: row.segment || row.Segment || '',
            tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
            source: 'import',
          };
          if (contact.name) contacts.push(contact);
          else errors.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Upsert contacts
    let imported = 0;
    for (const c of contacts) {
      await Contact.findOneAndUpdate(
        { user: req.user._id, $or: [{ phone: c.phone }, { email: c.email }, { name: c.name }].filter(x => Object.values(x)[0]) },
        c,
        { upsert: true, new: true }
      );
      imported++;
    }

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, data: { imported, errors: errors.length } });
  } catch (err) {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    next(err);
  }
};

// @route GET /api/contacts/export
exports.exportContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.find({ user: req.user._id, isActive: true });
    const headers = 'name,company,email,phone,whatsapp,facebook,instagram,tiktok,segment,tags\n';
    const rows = contacts.map(c =>
      [c.name, c.company, c.email, c.phone, c.whatsapp, c.facebook, c.instagram, c.tiktok, c.segment, c.tags.join(';')]
        .map(v => `"${(v || '').replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.send(headers + rows);
  } catch (err) { next(err); }
};
