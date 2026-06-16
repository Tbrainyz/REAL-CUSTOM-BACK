// ─── getWorkspaceId ───────────────────────────────────────────────────────────
// The core concept: ALL data belongs to the admin's "workspace".
// 
// - If the logged-in user IS the admin  → use their own ID
// - If the logged-in user is a sub-user → use their admin's ID (createdBy)
//
// This means: when an inventory_manager creates a product, it's stored under
// the admin's ID. When the admin views inventory, they see ALL products
// including those created by their sub-users.

exports.getWorkspaceId = (req) => {
  const user = req.user;
  if (!user) return null;
  // admin → their own ID is the workspace root
  if (user.role === 'admin') return user._id;
  // sub-user → their admin's ID is the workspace root
  return user.createdBy || user._id;
};

// Middleware version — attaches workspaceId to req for easy access
exports.attachWorkspace = (req, res, next) => {
  req.workspaceId = exports.getWorkspaceId(req);
  next();
};
