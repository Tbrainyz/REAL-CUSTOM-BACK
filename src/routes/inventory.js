const { attachWorkspace } = require('../middleware/workspace');
const express = require('express');
const router  = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  addMovement, getMovements,
} = require('../controllers/inventoryController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, attachWorkspace, requireRole('inventory_manager'));

router.get('/movements',  getMovements);
router.post('/movements', addMovement);
router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProduct).put(updateProduct).delete(deleteProduct);

module.exports = router;
