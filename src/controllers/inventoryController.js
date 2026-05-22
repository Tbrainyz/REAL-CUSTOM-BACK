const { Product, StockMovement } = require('../models/Inventory');
const { paginateResult } = require('../middleware/paginate');

// =================== PRODUCTS ===================

exports.getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category, lowStock } = req.query;
    const skip = (page - 1) * limit;
    const query = { user: req.user._id, isActive: true };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    if (category) query.category = category;
    if (lowStock === 'true') query.$expr = { $lte: ['$quantity', '$reorderLevel'] };

    const [products, total] = await Promise.all([
      Product.find(query).sort({ name: 1 }).skip(skip).limit(Number(limit)),
      Product.countDocuments(query),
    ]);
    res.json({ success: true, ...paginateResult(products, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    await Product.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isActive: false });
    res.json({ success: true, message: 'Product removed' });
  } catch (err) { next(err); }
};

// =================== STOCK MOVEMENTS ===================

exports.addMovement = async (req, res, next) => {
  try {
    const { productId, type, quantity, reference, notes } = req.body;
    if (!productId || !type || !quantity) {
      return res.status(400).json({ success: false, message: 'productId, type, and quantity are required' });
    }

    const product = await Product.findOne({ _id: productId, user: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const previousQuantity = product.quantity;
    let newQuantity;

    if (type === 'incoming') {
      newQuantity = previousQuantity + Number(quantity);
    } else {
      if (previousQuantity < quantity) {
        return res.status(400).json({ success: false, message: 'Insufficient stock' });
      }
      newQuantity = previousQuantity - Number(quantity);
    }

    // Update product quantity
    product.quantity = newQuantity;
    await product.save();

    // Create movement record
    const movement = await StockMovement.create({
      user: req.user._id,
      product: productId,
      type,
      quantity: Number(quantity),
      previousQuantity,
      newQuantity,
      reference,
      notes,
      createdBy: req.user._id,
    });

    const populated = await StockMovement.findById(movement._id).populate('product', 'name sku');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.getMovements = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, productId } = req.query;
    const skip = (page - 1) * limit;
    const query = { user: req.user._id };
    if (type) query.type = type;
    if (productId) query.product = productId;

    const [movements, total] = await Promise.all([
      StockMovement.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('product', 'name sku category'),
      StockMovement.countDocuments(query),
    ]);
    res.json({ success: true, ...paginateResult(movements, total, Number(page), Number(limit)) });
  } catch (err) { next(err); }
};
