const { Invoice, Expense } = require('../models/Finance');
const { paginateResult } = require('../middleware/paginate');

// =================== INVOICES ===================

exports.getInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    const query = { user: req.user._id };
    if (status) query.status = status;

    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Invoice.countDocuments(query),
    ]);
    res.json({ success: true, ...paginateResult(invoices, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};

exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

exports.createInvoice = async (req, res, next) => {
  try {
    const { client, clientEmail, dueDate, tax = 0, items } = req.body;

    if (!client || !items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client name and at least one item are required' 
      });
    }

    // Generate unique invoice number per user
    const invoiceCount = await Invoice.countDocuments({ user: req.user._id });
    const invoiceNumber = `INV-${req.user._id.toString().slice(-6).toUpperCase()}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

    const invoice = await Invoice.create({
      user: req.user._id,
      invoiceNumber,                    // Unique per user
      client,
      clientEmail: clientEmail || '',
      dueDate: dueDate || new Date(Date.now() + 7*24*60*60*1000),
      tax: Number(tax),
      items,
      status: 'pending',
    });

    res.status(201).json({ 
      success: true, 
      data: invoice 
    });

  } catch (err) {
    console.error("Create Invoice Error:", err);
    next(err);
  }
};

exports.updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

exports.deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (err) { next(err); }
};

exports.markInvoicePaid = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status: 'paid', paidAt: new Date() },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

// =================== EXPENSES ===================

exports.getExpenses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    const query = { user: req.user._id };
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      Expense.find(query).sort({ date: -1 }).skip(skip).limit(Number(limit)),
      Expense.countDocuments(query),
    ]);
    res.json({ success: true, ...paginateResult(expenses, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};

exports.createExpense = async (req, res, next) => {
  try {
    const expense = await Expense.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, data: expense });
  } catch (err) { next(err); }
};

exports.updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, data: expense });
  } catch (err) { next(err); }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) { next(err); }
};
