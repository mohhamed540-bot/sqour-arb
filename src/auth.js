const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Authorization token is required' });
  }

  const { findUserByToken } = require('./db');
  const user = findUserByToken(token);

  if (!user) {
    return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
  }

  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    req.user = null;
    return next();
  }

  const { findUserByToken } = require('./db');
  req.user = findUserByToken(token) || null;
  next();
}

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
}

module.exports = {
  generateToken,
  authRequired,
  optionalAuth,
  sanitizeText
};
