const Contact      = require('../models/Contact');
const MessageLog   = require('../models/Message');
const { Invoice, Expense } = require('../models/Finance');
const { Product }  = require('../models/Inventory');
const { getWorkspaceId } = require('../middleware/workspace');

// ─── GET /dashboard/stats ─────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);   // ← workspace: sees ALL sub-user data

    const [
      totalContacts,
      messagesSent,
      messagesPending,
      messagesFailed,
      paidInvoices,
      allExpenses,
      lowStockItems,
      totalProducts,
      totalMovements,
      scheduled,
    ] = await Promise.all([
      Contact.countDocuments({ user: wsId, isActive: true }),
      MessageLog.countDocuments({ user: wsId, status: 'sent' }),
      MessageLog.countDocuments({ user: wsId, status: 'pending' }),
      MessageLog.countDocuments({ user: wsId, status: 'failed' }),
      Invoice.find({ user: wsId, status: 'paid' }),
      Expense.aggregate([{ $match: { user: wsId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Product.countDocuments({ user: wsId, isActive: true, $expr: { $lte: ['$quantity', '$reorderLevel'] } }),
      Product.countDocuments({ user: wsId, isActive: true }),
      // StockMovement count if exists
      (async () => {
        try {
          const { StockMovement } = require('../models/Inventory');
          return await StockMovement.countDocuments({ user: wsId });
        } catch { return 0; }
      })(),
      MessageLog.countDocuments({ user: wsId, status: 'pending', scheduledAt: { $exists: true } }),
    ]);

    const totalRevenue  = paidInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalExpenses = allExpenses[0]?.total || 0;
    const netCashFlow   = totalRevenue - totalExpenses;

    res.json({
      success: true,
      data: {
        totalContacts,
        messagesSent,
        messagesPending,
        messagesFailed,
        scheduled,
        totalRevenue,
        totalExpenses,
        netCashFlow,
        lowStockItems,
        totalProducts,
        totalMovements,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /dashboard/activity ──────────────────────────────────────────────────
exports.getRecentActivity = async (req, res, next) => {
  try {
    const wsId = getWorkspaceId(req);
    const logs = await MessageLog.find({ user: wsId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('contact', 'name');
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};

// ─── GET /dashboard/cashflow ──────────────────────────────────────────────────
exports.getCashFlow = async (req, res, next) => {
  try {
    const wsId  = getWorkspaceId(req);
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [incomeData, expenseData] = await Promise.all([
      Invoice.aggregate([
        { $match: { user: wsId, status: 'paid', paidAt: { $gte: start, $lte: end } } },
        { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, income: { $sum: '$total' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Expense.aggregate([
        { $match: { user: wsId, date: { $gte: start, $lte: end } } },
        { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, expenses: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    // Build 6-month grid
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month:    d.toLocaleString('default', { month: 'short' }),
        year:     d.getFullYear(),
        monthNum: d.getMonth() + 1,
        income:   0,
        expenses: 0,
      });
    }

    incomeData.forEach(d => {
      const m = months.find(m => m.monthNum === d._id.month && m.year === d._id.year);
      if (m) m.income = d.income;
    });
    expenseData.forEach(d => {
      const m = months.find(m => m.monthNum === d._id.month && m.year === d._id.year);
      if (m) m.expenses = d.expenses;
    });

    res.json({ success: true, data: months });
  } catch (err) { next(err); }
};
