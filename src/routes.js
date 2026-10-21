const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');
const { findUserById } = require('./db');

function generateToken(user) {
  return jwt.sign({
    sub: user.id,
    username: user.username,
    role: user.role
  }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Authorization token is required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
  }

  const user = findUserById(decoded.sub);
  if (!user) {
    return res.status(401).json({ ok: false, message: 'User not found' });
  }

  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, message: 'Access denied' });
    }
    next();
  };
}

module.exports = {
  generateToken,
  verifyToken,
  authRequired,
  requireRole,
  sanitizeText
};
