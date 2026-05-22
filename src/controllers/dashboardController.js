const Contact = require('../models/Contact');
const { MessageLog } = require('../models/Message');
const { Invoice, Expense } = require('../models/Finance');
const { Product } = require('../models/Inventory');

// @route GET /api/dashboard/stats
exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [
      totalContacts,
      messagesSent,
      pendingMessages,
      failedMessages,
      invoices,
      totalExpenses,
      lowStockItems,
    ] = await Promise.all([
      Contact.countDocuments({ user: userId, isActive: true }),
      MessageLog.countDocuments({ user: userId, status: 'sent' }),
      MessageLog.countDocuments({ user: userId, status: 'pending' }),
      MessageLog.countDocuments({ user: userId, status: 'failed' }),
      Invoice.find({ user: userId, status: 'paid' }),
      Expense.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Product.countDocuments({ user: userId, isActive: true, $expr: { $lte: ['$quantity', '$reorderLevel'] } }),
    ]);

    const totalRevenue = invoices.reduce((s, inv) => s + inv.total, 0);
    const expensesTotal = totalExpenses[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalContacts,
        messagesSent,
        pendingMessages,
        failedMessages,
        totalRevenue,
        totalExpenses: expensesTotal,
        netCashFlow: totalRevenue - expensesTotal,
        lowStockItems,
      },
    });
  } catch (err) { next(err); }
};

// @route GET /api/dashboard/activity
exports.getRecentActivity = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const logs = await MessageLog.find({ user: userId })
      .sort({ sentAt: -1 })
      .limit(10)
      .populate('contact', 'name');
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};

// @route GET /api/dashboard/cashflow
exports.getCashFlow = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const months = 6;

    const cashFlow = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);

      const [incomeData, expenseData] = await Promise.all([
        Invoice.aggregate([
          { $match: { user: userId, status: 'paid', paidAt: { $gte: start, $lte: end } } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
        Expense.aggregate([
          { $match: { user: userId, date: { $gte: start, $lte: end } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
      ]);

      cashFlow.push({
        month: date.toLocaleString('default', { month: 'short' }),
        income: incomeData[0]?.total || 0,
        expenses: expenseData[0]?.total || 0,
      });
    }

    res.json({ success: true, data: cashFlow });
  } catch (err) { next(err); }
};
