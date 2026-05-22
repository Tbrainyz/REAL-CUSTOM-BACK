const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, trim: true, uppercase: true },
  category: { type: String, trim: true },
  description: { type: String },
  quantity: { type: Number, default: 0, min: 0 },
  reorderLevel: { type: Number, default: 10 },
  price: { type: Number, required: true, min: 0 }, // selling price
  costPrice: { type: Number, default: 0, min: 0 },
  warehouse: { type: String, default: 'Main Warehouse' },
  unit: { type: String, default: 'piece' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

productSchema.index({ user: 1, sku: 1 }, { unique: true });
productSchema.index({ user: 1, category: 1 });

const stockMovementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  type: { type: String, enum: ['incoming', 'outgoing'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  previousQuantity: { type: Number },
  newQuantity: { type: Number },
  reference: { type: String, trim: true }, // PO number, SO number, etc.
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockMovementSchema.index({ user: 1, product: 1 });
stockMovementSchema.index({ user: 1, type: 1 });
stockMovementSchema.index({ createdAt: -1 });

const Product = mongoose.model('Product', productSchema);
const StockMovement = mongoose.model('StockMovement', stockMovementSchema);

module.exports = { Product, StockMovement };
