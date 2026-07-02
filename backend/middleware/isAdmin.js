/**
 * isAdmin middleware
 * Must be used AFTER the `auth` middleware so req.user is already set.
 * Rejects any request where the authenticated user's role is not 'Admin'.
 */
module.exports = function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Admin access only. Insufficient privileges.' });
  }

  next();
};
