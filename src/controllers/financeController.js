const { getWorkspaceId } = require('../middleware/workspace');
const { Invoice, Expense } = require('../models/Finance');
const { paginateResult } = require('../middleware/paginate');

// =================== INVOICES ===================

exports.getInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    const wsId = getWorkspaceId(req);
    const query = { user: wsId };
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
    const wsId = getWorkspaceId(req);
    const { client, clientEmail, dueDate, tax = 0, items } = req.body;

    if (!client || !items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client name and at least one item are required' 
      });
    }

    // Generate unique invoice number per user
    const invoiceCount = await Invoice.countDocuments({ user: wsId });
    const invoiceNumber = `INV-${req.user._id.toString().slice(-6).toUpperCase()}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

    const invoice = await Invoice.create({
      user: wsId,
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
    const wsId = getWorkspaceId(req);
    const query = { user: wsId };
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

// ─── GET /invoices/export ──────────────────────────────────────────────────────
exports.exportInvoices = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const invoices = await Invoice.find({ user: wsId }).sort({ createdAt: -1 });

    const rows = invoices.map(inv => ({
      'Invoice Number': inv.invoiceNumber,
      'Client':         inv.client,
      'Client Email':   inv.clientEmail || '',
      'Items':          (inv.items || []).map(i => `${i.description} (x${i.quantity})`).join(', '),
      'Subtotal':       inv.subtotal || 0,
      'Tax':            inv.tax || 0,
      'Total':          inv.total || 0,
      'Status':         inv.status,
      'Due Date':       inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-NG') : '',
      'Paid At':        inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-NG') : '',
      'Created':        new Date(inv.createdAt).toLocaleDateString('en-NG'),
    }));

    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=invoices_report.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
};

// ─── GET /expenses/export ──────────────────────────────────────────────────────
exports.exportExpenses = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const expenses = await Expense.find({ user: wsId }).sort({ date: -1 });

    const rows = expenses.map(exp => ({
      'Description': exp.description,
      'Category':    exp.category,
      'Amount':      exp.amount,
      'Date':        exp.date ? new Date(exp.date).toLocaleDateString('en-NG') : '',
      'Created':     new Date(exp.createdAt).toLocaleDateString('en-NG'),
    }));

    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=expenses_report.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
};

// ─── GET /invoices/cashflow-export ─────────────────────────────────────────────
// Combined financial report: invoices + expenses + summary
exports.exportFinanceReport = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const [invoices, expenses] = await Promise.all([
      Invoice.find({ user: wsId }).sort({ createdAt: -1 }),
      Expense.find({ user: wsId }).sort({ date: -1 }),
    ]);

    const totalRevenue  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netCashFlow    = totalRevenue - totalExpenses;

    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryRows = [
      { Metric: 'Total Revenue (Paid Invoices)', Value: totalRevenue },
      { Metric: 'Total Expenses',                Value: totalExpenses },
      { Metric: 'Net Cash Flow',                 Value: netCashFlow },
      { Metric: 'Total Invoices',                Value: invoices.length },
      { Metric: 'Total Expense Records',         Value: expenses.length },
      { Metric: 'Report Generated',              Value: new Date().toLocaleString('en-NG') },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

    // Invoices sheet
    const invoiceRows = invoices.map(inv => ({
      'Invoice #': inv.invoiceNumber, 'Client': inv.client, 'Total': inv.total || 0,
      'Status': inv.status, 'Due Date': inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-NG') : '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), 'Invoices');

    // Expenses sheet
    const expenseRows = expenses.map(exp => ({
      'Description': exp.description, 'Category': exp.category, 'Amount': exp.amount,
      'Date': exp.date ? new Date(exp.date).toLocaleDateString('en-NG') : '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Expenses');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=finance_report.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
};
