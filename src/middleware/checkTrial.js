// ─── checkTrial middleware ─────────────────────────────────────────────────────
// TEMPORARILY DISABLED for testing — allows all authenticated users through.
// Re-enable this when ready to enforce subscriptions.

exports.checkTrial = (req, res, next) => {
  return next();  // bypass all trial/subscription checks
};
