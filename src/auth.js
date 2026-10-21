const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

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
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Authorization token is required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
  }

  const { findUserById } = require('./db');
  const user = findUserById(decoded.sub);
  if (!user) {
    return res.status(401).json({ ok: false, message: 'User not found' });
  }

  req.user = user;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ ok: false, message: 'Access denied' });
    }
    next();
  };
}

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
}

module.exports = {
  generateToken,
  verifyToken,
  authRequired,
  requireRole,
  sanitizeText
};
