const jwt = require('jsonwebtoken');

const unauthorized = (res, message = 'Unauthorized') =>
  res.status(401).json({ success: false, message });

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return unauthorized(res, 'Missing or invalid Authorization header');
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (error) {
    return unauthorized(res, 'Invalid or expired token');
  }
};

const requireManager = (req, res, next) => {
  const isManager =
    req.user && (req.user.role === 'manager' || req.user.sub === 'admin');
  if (!isManager) {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux gestionnaires',
    });
  }
  return next();
};

module.exports = {
  requireAuth,
  requireManager,
};
