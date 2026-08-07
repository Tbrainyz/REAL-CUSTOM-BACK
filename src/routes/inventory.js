const { attachWorkspace } = require('../middleware/workspace');
const express = require('express');
const router  = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  addMovement, getMovements, exportProducts, exportMovements,
} = require('../controllers/inventoryController');
const { protect, requireRole, adminOnly } = require('../middleware/auth');

router.use(protect, attachWorkspace, requireRole('inventory_manager'));

// Export routes must come before /:id — admin-only, sub-users can manage but not export
router.get('/export',            adminOnly, exportProducts);
router.get('/movements/export',  adminOnly, exportMovements);
router.get('/movements',  getMovements);
router.post('/movements', addMovement);
router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProduct).put(updateProduct).delete(deleteProduct);

module.exports = router;
