const { Invoice, Expense } = require('../models/Finance');
const { Product, StockMovement } = require('../models/Inventory');
const { getWorkspaceId } = require('../middleware/workspace');

// ─── Build unified cash ledger from invoices (income) + expenses ──────────────
const buildLedger = async (wsId, { from, to, type } = {}) => {
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to)   dateFilter.$lte = new Date(to);

  const [invoices, expenses] = await Promise.all([
    type === 'expense'
      ? []
      : Invoice.find({ user: wsId, status: 'paid', ...(from || to ? { paidAt: dateFilter } : {}) }).sort({ paidAt: -1 }),
    type === 'income'
      ? []
      : Expense.find({ user: wsId, ...(from || to ? { date: dateFilter } : {}) }).sort({ date: -1 }),
  ]);

  const entries = [
    ...invoices.map(inv => ({
      id: inv._id, date: inv.paidAt || inv.createdAt, type: 'income',
      category: 'Invoice Payment', description: `Invoice #${inv.invoiceNumber} — ${inv.client}`,
      reference: inv.invoiceNumber, amount: inv.total || 0, source: 'invoice',
    })),
    ...expenses.map(exp => ({
      id: exp._id, date: exp.date, type: 'expense',
      category: exp.category || 'Uncategorized', description: exp.description,
      reference: exp._id.toString().slice(-6).toUpperCase(), amount: exp.amount || 0, source: 'expense',
    })),
  ];

  entries.sort((a, b) => new Date(b.date) - new Date(a.date));

  const chronological = [...entries].reverse();
  let balance = 0;
  const withBalance = chronological.map(e => {
    balance += e.type === 'income' ? e.amount : -e.amount;
    return { ...e, balance };
  });

  return withBalance.reverse();
};

// ─── Stock movement list (product flow — every unit that moved in/out) ────────
const buildStockMovements = async (wsId, { from, to } = {}) => {
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to)   dateFilter.$lte = new Date(to);

  const movements = await StockMovement.find({
    user: wsId,
    ...(from || to ? { createdAt: dateFilter } : {}),
  })
    .populate('product', 'name sku costPrice price')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });

  return movements.map(m => ({
    id:               m._id,
    date:             m.createdAt,
    product:          m.product?.name || 'Unknown product',
    sku:              m.product?.sku  || '',
    type:             m.type,           // 'incoming' | 'outgoing' | 'adjustment'
    quantity:         m.quantity,
    previousQuantity: m.previousQuantity,
    newQuantity:      m.newQuantity,
    unitCost:         m.product?.costPrice || 0,
    totalValue:       (m.product?.costPrice || 0) * m.quantity,
    reference:        m.reference || '',
    notes:            m.notes || '',
    recordedBy:       m.createdBy?.name || '',
  }));
};

// ─── Product flow (current snapshot: stock in hand + values) ──────────────────
const buildProductFlow = async (wsId) => {
  const products = await Product.find({ user: wsId, isActive: true }).sort({ name: 1 });

  return products.map(p => ({
    id:            p._id,
    name:          p.name,
    sku:           p.sku,
    category:      p.category || '',
    quantity:      p.quantity,
    reorderLevel:  p.reorderLevel,
    costPrice:     p.costPrice || 0,
    sellingPrice:  p.price || 0,
    stockValue:    p.quantity * (p.costPrice || 0),
    retailValue:   p.quantity * (p.price || 0),
    status:        p.quantity <= p.reorderLevel ? 'low_stock' : 'in_stock',
  }));
};

// ─── Inventory summary numbers ─────────────────────────────────────────────────
const buildInventorySummary = (products) => {
  const totalStockValue  = products.reduce((s, p) => s + p.stockValue, 0);
  const totalRetailValue = products.reduce((s, p) => s + p.retailValue, 0);
  const lowStockCount    = products.filter(p => p.status === 'low_stock').length;

  return {
    totalProducts: products.length,
    totalStockValue,
    totalRetailValue,
    potentialProfit: totalRetailValue - totalStockValue,
    lowStockCount,
  };
};

// ─── GET /bookkeeping ───────────────────────────────────────────────────────────
// Returns everything needed for the tabbed Book Keeping page in one call.
exports.getLedger = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const { from, to, type, page = 1, limit = 20 } = req.query;

    const [ledgerEntries, movements, products] = await Promise.all([
      buildLedger(wsId, { from, to, type }),
      buildStockMovements(wsId, { from, to }),
      buildProductFlow(wsId),
    ]);

    const totalIncome   = ledgerEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpenses = ledgerEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const netBalance     = totalIncome - totalExpenses;
    const inventorySummary = buildInventorySummary(products);

    const skip = (page - 1) * limit;
    const pagedLedger    = ledgerEntries.slice(skip, skip + Number(limit));
    const pagedMovements = movements.slice(skip, skip + Number(limit));
    const pagedProducts  = products.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      data: {
        ledger:    pagedLedger,
        movements: pagedMovements,
        products:  pagedProducts,
      },
      summary: { totalIncome, totalExpenses, netBalance, totalEntries: ledgerEntries.length },
      inventorySummary,
      pagination: {
        ledger:    { total: ledgerEntries.length, pages: Math.ceil(ledgerEntries.length / limit) },
        movements: { total: movements.length,     pages: Math.ceil(movements.length / limit) },
        products:  { total: products.length,       pages: Math.ceil(products.length / limit) },
        page: Number(page), limit: Number(limit),
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /bookkeeping/export ─────────────────────────────────────────────────────
// Full workbook: Summary, Ledger, Stock Movements, Products
exports.exportLedger = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const { from, to, type } = req.query;

    const [ledgerEntries, movements, products] = await Promise.all([
      buildLedger(wsId, { from, to, type }),
      buildStockMovements(wsId, { from, to }),
      buildProductFlow(wsId),
    ]);

    const totalIncome   = ledgerEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpenses = ledgerEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const inventorySummary = buildInventorySummary(products);

    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryRows = [
      { Metric: 'Total Income',             Value: totalIncome },
      { Metric: 'Total Expenses',           Value: totalExpenses },
      { Metric: 'Net Balance',              Value: totalIncome - totalExpenses },
      { Metric: 'Total Ledger Entries',     Value: ledgerEntries.length },
      { Metric: 'Total Products',           Value: inventorySummary.totalProducts },
      { Metric: 'Total Stock Value (cost)', Value: inventorySummary.totalStockValue },
      { Metric: 'Total Retail Value',       Value: inventorySummary.totalRetailValue },
      { Metric: 'Potential Profit',         Value: inventorySummary.potentialProfit },
      { Metric: 'Low Stock Items',          Value: inventorySummary.lowStockCount },
      { Metric: 'Total Stock Movements',    Value: movements.length },
      { Metric: 'Period',                   Value: from || to ? `${from || 'start'} to ${to || 'now'}` : 'All time' },
      { Metric: 'Generated',                Value: new Date().toLocaleString('en-NG') },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

    // Ledger sheet
    const ledgerRows = ledgerEntries.map(e => ({
      'Date': new Date(e.date).toLocaleDateString('en-NG'), 'Type': e.type === 'income' ? 'Income' : 'Expense',
      'Category': e.category, 'Description': e.description, 'Reference': e.reference,
      'Income (₦)': e.type === 'income' ? e.amount : '', 'Expense (₦)': e.type === 'expense' ? e.amount : '',
      'Balance (₦)': e.balance,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ledgerRows), 'Ledger');

    // Stock Movements sheet
    const movementRows = movements.map(m => ({
      'Date': new Date(m.date).toLocaleString('en-NG'), 'Product': m.product, 'SKU': m.sku,
      'Type': m.type, 'Quantity': m.quantity, 'Previous Qty': m.previousQuantity, 'New Qty': m.newQuantity,
      'Unit Cost (₦)': m.unitCost, 'Total Value (₦)': m.totalValue, 'Reference': m.reference,
      'Notes': m.notes, 'Recorded By': m.recordedBy,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movementRows), 'Stock Movements');

    // Products sheet
    const productRows = products.map(p => ({
      'Product': p.name, 'SKU': p.sku, 'Category': p.category, 'Quantity': p.quantity,
      'Reorder Level': p.reorderLevel, 'Cost Price (₦)': p.costPrice, 'Selling Price (₦)': p.sellingPrice,
      'Stock Value (₦)': p.stockValue, 'Retail Value (₦)': p.retailValue,
      'Status': p.status === 'low_stock' ? 'Low Stock' : 'In Stock',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Products');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=bookkeeping_full_report.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
};
