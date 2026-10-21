const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function safeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, token, ...sanitized } = user;
  return sanitized;
}

module.exports = {
  generateToken,
  hashPassword,
  safeUser
};
