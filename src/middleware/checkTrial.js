// ─── checkTrial middleware ─────────────────────────────────────────────────────
// Runs AFTER protect (req.user is set).
// Sub-users are never blocked — only admin accounts are subject to trial/subscription.
// If bypassTrial is true → always passes (for dev/admin accounts).

exports.checkTrial = (req, res, next) => {
  const user = req.user;

  // Sub-users are never blocked — they inherit access from their admin
  if (user.role !== 'admin') return next();

  // Dev bypass
  if (user.bypassTrial) return next();

  // Active subscription → full access
  if (user.subscription?.status === 'active') return next();

  // Trial — check if still within window
  if (user.subscription?.status === 'trial') {
    const trialEndsAt = user.subscription?.trialEndsAt;
    if (!trialEndsAt || new Date(trialEndsAt) > new Date()) {
      return next();  // still in trial
    }
  }

  // Trial expired / inactive
  const trialEndsAt = user.subscription?.trialEndsAt;
  const daysAgo = trialEndsAt
    ? Math.floor((Date.now() - new Date(trialEndsAt)) / (1000 * 60 * 60 * 24))
    : null;

  return res.status(402).json({
    success:  false,
    code:     'TRIAL_EXPIRED',
    message:  'Your free trial has ended. Please subscribe to continue.',
    daysAgo,
    trialEndsAt,
  });
};
