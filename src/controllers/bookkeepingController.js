const { Invoice, Expense } = require('../models/Finance');
const { Product, StockMovement } = require('../models/Inventory');
const { getWorkspaceId } = require('../middleware/workspace');

// ─── Build unified ledger entries from invoices, expenses, and stock movements ──
const buildLedger = async (wsId, { from, to, type } = {}) => {
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to)   dateFilter.$lte = new Date(to);

  const wantsFinance   = !type || type === 'income' || type === 'expense';
  const wantsInventory = !type || type === 'inventory';

  const [invoices, expenses, movements] = await Promise.all([
    (wantsFinance && type !== 'expense')
      ? Invoice.find({ user: wsId, status: 'paid', ...(from || to ? { paidAt: dateFilter } : {}) }).sort({ paidAt: -1 })
      : [],
    (wantsFinance && type !== 'income')
      ? Expense.find({ user: wsId, ...(from || to ? { date: dateFilter } : {}) }).sort({ date: -1 })
      : [],
    wantsInventory
      ? StockMovement.find({ user: wsId, ...(from || to ? { createdAt: dateFilter } : {}) })
          .populate('product', 'name sku costPrice price')
          .sort({ createdAt: -1 })
      : [],
  ]);

  const entries = [
    ...invoices.map(inv => ({
      id:          inv._id,
      date:        inv.paidAt || inv.createdAt,
      type:        'income',
      category:    'Invoice Payment',
      description: `Invoice #${inv.invoiceNumber} — ${inv.client}`,
      reference:   inv.invoiceNumber,
      amount:      inv.total || 0,
      source:      'invoice',
    })),
    ...expenses.map(exp => ({
      id:          exp._id,
      date:        exp.date,
      type:        'expense',
      category:    exp.category || 'Uncategorized',
      description: exp.description,
      reference:   exp._id.toString().slice(-6).toUpperCase(),
      amount:      exp.amount || 0,
      source:      'expense',
    })),
    // Stock movements — incoming stock is a cost (like an expense), outgoing is
    // tracked for reference but doesn't move cash (that's captured via invoices).
    ...movements
      .filter(m => m.type === 'incoming')  // only incoming stock has a cash cost
      .map(m => ({
        id:          m._id,
        date:        m.createdAt,
        type:        'expense',
        category:    'Inventory Purchase',
        description: `Stock IN — ${m.product?.name || 'Unknown product'} (${m.quantity} units)`,
        reference:   m.reference || m._id.toString().slice(-6).toUpperCase(),
        amount:      (m.product?.costPrice || 0) * m.quantity,
        source:      'inventory',
      })),
  ];

  entries.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Running balance — oldest to newest, then reverse for display
  const chronological = [...entries].reverse();
  let balance = 0;
  const withBalance = chronological.map(e => {
    balance += e.type === 'income' ? e.amount : -e.amount;
    return { ...e, balance };
  });

  return withBalance.reverse();
};

// ─── Inventory summary (separate from cash ledger — stock isn't cash) ─────────
const buildInventorySummary = async (wsId) => {
  const products = await Product.find({ user: wsId, isActive: true });

  const totalStockValue = products.reduce((s, p) => s + (p.quantity * (p.costPrice || 0)), 0);
  const totalRetailValue = products.reduce((s, p) => s + (p.quantity * (p.price || 0)), 0);
  const lowStockCount = products.filter(p => p.quantity <= p.reorderLevel).length;

  return {
    totalProducts:   products.length,
    totalStockValue,
    totalRetailValue,
    potentialProfit: totalRetailValue - totalStockValue,
    lowStockCount,
  };
};

// ─── GET /bookkeeping ───────────────────────────────────────────────────────────
exports.getLedger = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const { from, to, type, page = 1, limit = 30 } = req.query;

    const [entries, inventorySummary] = await Promise.all([
      buildLedger(wsId, { from, to, type }),
      buildInventorySummary(wsId),
    ]);

    const totalIncome   = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const netBalance     = totalIncome - totalExpenses;

    const skip  = (page - 1) * limit;
    const paged = entries.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      data: paged,
      summary: { totalIncome, totalExpenses, netBalance, totalEntries: entries.length },
      inventorySummary,
      pagination: {
        total: entries.length,
        page:  Number(page),
        pages: Math.ceil(entries.length / limit),
        limit: Number(limit),
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /bookkeeping/export ─────────────────────────────────────────────────────
exports.exportLedger = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const { from, to, type } = req.query;

    const [entries, inventorySummary] = await Promise.all([
      buildLedger(wsId, { from, to, type }),
      buildInventorySummary(wsId),
    ]);

    const totalIncome   = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

    const rows = entries.map(e => ({
      'Date':        new Date(e.date).toLocaleDateString('en-NG'),
      'Type':        e.type === 'income' ? 'Income' : 'Expense',
      'Category':    e.category,
      'Description': e.description,
      'Reference':   e.reference,
      'Income (₦)':  e.type === 'income' ? e.amount : '',
      'Expense (₦)': e.type === 'expense' ? e.amount : '',
      'Balance (₦)': e.balance,
    }));

    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { Metric: 'Total Income',           Value: totalIncome },
      { Metric: 'Total Expenses',         Value: totalExpenses },
      { Metric: 'Net Balance',            Value: totalIncome - totalExpenses },
      { Metric: 'Total Entries',          Value: entries.length },
      { Metric: 'Total Products',         Value: inventorySummary.totalProducts },
      { Metric: 'Total Stock Value (cost)', Value: inventorySummary.totalStockValue },
      { Metric: 'Total Retail Value',     Value: inventorySummary.totalRetailValue },
      { Metric: 'Potential Profit',       Value: inventorySummary.potentialProfit },
      { Metric: 'Low Stock Items',        Value: inventorySummary.lowStockCount },
      { Metric: 'Period',                 Value: from || to ? `${from || 'start'} to ${to || 'now'}` : 'All time' },
      { Metric: 'Generated',              Value: new Date().toLocaleString('en-NG') },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Ledger');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=bookkeeping_ledger.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
};
