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

module.exports = {
  requireAuth,
};
