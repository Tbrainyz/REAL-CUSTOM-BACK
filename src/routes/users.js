const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getUsers,
  getRoles,
  createUser,
  getUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
} = require('../controllers/userController');

// All user-management routes require: logged in + admin role
router.use(protect, adminOnly);

router.get('/',           getUsers);       // GET  /users
router.get('/roles',      getRoles);       // GET  /users/roles
router.post('/',          createUser);     // POST /users
router.get('/:id',        getUser);        // GET  /users/:id
router.put('/:id',        updateUser);     // PUT  /users/:id
router.put('/:id/toggle-status',   toggleUserStatus);   // PUT /users/:id/toggle-status
router.put('/:id/reset-password',  resetUserPassword);  // PUT /users/:id/reset-password
router.delete('/:id',     deleteUser);     // DELETE /users/:id

module.exports = router;
