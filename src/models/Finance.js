const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  total: { type: Number },
}, { _id: false });

invoiceItemSchema.pre('save', function (next) {
  this.total = this.quantity * this.price;
  next();
});

const invoiceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNumber: { type: String, unique: true },
  client: { type: String, required: true, trim: true },
  clientEmail: { type: String, trim: true, lowercase: true },
  items: [invoiceItemSchema],
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 }, // percentage
  taxAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'sent', 'paid', 'overdue'], default: 'draft' },
  dueDate: { type: Date },
  paidAt: { type: Date },
  notes: { type: String },
}, { timestamps: true });

// Auto-generate invoice number
invoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Invoice').countDocuments({ user: this.user });
    this.invoiceNumber = `INV-${String(count + 1).padStart(4, '0')}`;
  }
  // Recalculate totals
  this.subtotal = this.items.reduce((s, item) => s + (item.quantity * item.price), 0);
  this.taxAmount = this.subtotal * (this.tax / 100);
  this.total = this.subtotal + this.taxAmount;
  next();
});

invoiceSchema.index({ user: 1, status: 1 });

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: {
    type: String,
    enum: ['Operations', 'Marketing', 'Salaries', 'Utilities', 'Rent', 'Transport', 'Equipment', 'Software', 'Other'],
    default: 'Operations'
  },
  date: { type: Date, default: Date.now },
  receipt: { type: String },
  notes: { type: String },
}, { timestamps: true });

expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);
const Expense = mongoose.model('Expense', expenseSchema);

module.exports = { Invoice, Expense };
