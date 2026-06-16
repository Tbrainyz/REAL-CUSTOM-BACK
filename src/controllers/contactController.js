const Contact = require('../models/Contact');
const { getWorkspaceId } = require('../middleware/workspace');

exports.getContacts = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const { page = 1, limit = 20, search, segment, tag } = req.query;
    const query = { user: wsId, isActive: true };

    if (search) {
      query.$or = [
        { name:      { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
        { phone:     { $regex: search, $options: 'i' } },
        { company:   { $regex: search, $options: 'i' } },
        { whatsapp:  { $regex: search, $options: 'i' } },
        { instagram: { $regex: search, $options: 'i' } },
        { facebook:  { $regex: search, $options: 'i' } },
        { tiktok:    { $regex: search, $options: 'i' } },
      ];
    }
    if (segment) query.segment = segment;
    if (tag)     query.tags    = tag;

    const skip  = (page - 1) * limit;
    const total = await Contact.countDocuments(query);
    const data  = await Contact.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));

    res.json({ success: true, data, pagination: { total, page: Number(page), pages: Math.ceil(total / limit), limit: Number(limit) } });
  } catch (err) { next(err); }
};

exports.getContact = async (req, res, next) => {
  try {
    const wsId    = getWorkspaceId(req);
    const contact = await Contact.findOne({ _id: req.params.id, user: wsId });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, data: contact });
  } catch (err) { next(err); }
};

exports.createContact = async (req, res, next) => {
  try {
    const wsId   = getWorkspaceId(req);
    const contact = await Contact.create({ ...req.body, user: wsId });
    res.status(201).json({ success: true, data: contact });
  } catch (err) { next(err); }
};

exports.updateContact = async (req, res, next) => {
  try {
    const wsId    = getWorkspaceId(req);
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, user: wsId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, data: contact });
  } catch (err) { next(err); }
};

exports.deleteContact = async (req, res, next) => {
  try {
    const wsId    = getWorkspaceId(req);
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, user: wsId });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) { next(err); }
};

exports.importContacts = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const fs   = require('fs');
    const path = require('path');
    const ext  = path.extname(req.file.originalname).toLowerCase();
    let rows   = [];

    if (ext === '.csv') {
      const csv  = require('csv-parse/sync');
      const text = fs.readFileSync(req.file.path, 'utf8');
      rows = csv.parse(text, { columns: true, skip_empty_lines: true });
    } else {
      const XLSX = require('xlsx');
      const wb   = XLSX.readFile(req.file.path);
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    }

    let created = 0, skipped = 0;
    for (const r of rows) {
      const phone = r.phone || r.Phone || r.PHONE || '';
      const email = r.email || r.Email || r.EMAIL || '';
      const name  = r.name  || r.Name  || r.NAME  || 'Unknown';
      if (!phone && !email && !name) { skipped++; continue; }
      try {
        await Contact.findOneAndUpdate(
          { user: wsId, $or: [phone && { phone }, email && { email }, { name }].filter(x => Object.values(x)[0]) },
          { $setOnInsert: { user: wsId, name, phone, email, company: r.company || r.Company || '', whatsapp: r.whatsapp || r.WhatsApp || '' } },
          { upsert: true, new: true }
        );
        created++;
      } catch { skipped++; }
    }

    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `Import done: ${created} added, ${skipped} skipped` });
  } catch (err) { next(err); }
};

exports.exportContacts = async (req, res, next) => {
  try {
    const wsId    = getWorkspaceId(req);
    const contacts = await Contact.find({ user: wsId, isActive: true });
    const rows = contacts.map(c => ({
      name: c.name, email: c.email, phone: c.phone, company: c.company,
      whatsapp: c.whatsapp, facebook: c.facebook, instagram: c.instagram,
      tiktok: c.tiktok, segment: c.segment, tags: c.tags?.join(', '),
    }));

    const XLSX = require('xlsx');
    const ws   = XLSX.utils.json_to_sheet(rows);
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    const buf  = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=contacts.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
};
