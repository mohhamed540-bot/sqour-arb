const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { DATA_DIR, DEFAULT_ROOM } = require('./config');

let db;

function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, 'app.db'));

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      lastSeen TEXT
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      isPrivate INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bans (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      reason TEXT,
      bannedBy TEXT,
      createdAt TEXT NOT NULL,
      expiresAt TEXT
    );
  `);

  const roomCount = db.prepare('SELECT COUNT(*) AS count FROM rooms').get().count;
  if (roomCount === 0) {
    db.prepare('INSERT INTO rooms (id, name, description, createdBy, createdAt, isPrivate) VALUES (?, ?, ?, ?, ?, ?)').run(
      'general',
      DEFAULT_ROOM,
      'غرفة عامة',
      'system',
      new Date().toISOString(),
      0
    );
  }

  const adminCount = db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = ?').get('admin').count;
  if (adminCount === 0) {
    const adminUser = {
      id: crypto.randomUUID(),
      username: 'admin',
      displayName: 'Administrator',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };

    db.prepare('INSERT INTO users (id, username, displayName, passwordHash, role, status, createdAt, lastSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      adminUser.id,
      adminUser.username,
      adminUser.displayName,
      adminUser.passwordHash,
      adminUser.role,
      adminUser.status,
      adminUser.createdAt,
      adminUser.lastSeen
    );
  }

  return db;
}

function getDb() {
  if (!db) return initDatabase();
  return db;
}

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
}

function getUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY createdAt DESC').all();
}

function getRooms() {
  return getDb().prepare('SELECT * FROM rooms ORDER BY createdAt DESC').all();
}

function getRoomById(roomId) {
  return getDb().prepare('SELECT * FROM rooms WHERE id = ? OR name = ?').get(roomId, roomId) || null;
}

function getRoomByName(name) {
  return getDb().prepare('SELECT * FROM rooms WHERE name = ?').get(name) || null;
}

function createUser({ username, password, displayName, role = 'user' }) {
  const cleanUsername = sanitizeText(username, '');
  if (!cleanUsername) throw new Error('Username is required');
  if (String(password).length < 4) throw new Error('Password must be at least 4 characters');

  const existing = getDb().prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (existing) throw new Error('Username already exists');

  const user = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    displayName: sanitizeText(displayName || cleanUsername, cleanUsername),
    passwordHash: bcrypt.hashSync(String(password), 10),
    role,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };

  getDb().prepare('INSERT INTO users (id, username, displayName, passwordHash, role, status, createdAt, lastSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    user.id,
    user.username,
    user.displayName,
    user.passwordHash,
    user.role,
    user.status,
    user.createdAt,
    user.lastSeen
  );

  return user;
}

function findUserByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}

function findUserById(userId) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
}

function verifyPassword(user, password) {
  if (!user) return false;
  return bcrypt.compareSync(String(password), user.passwordHash);
}

function createRoom({ name, description = '', createdBy, isPrivate = false }) {
  const roomName = sanitizeText(name, '');
  if (!roomName) throw new Error('Room name is required');

  if (getRoomByName(roomName)) {
    throw new Error('Room already exists');
  }

  const room = {
    id: crypto.randomUUID(),
    name: roomName,
    description: sanitizeText(description, ''),
    createdBy,
    createdAt: new Date().toISOString(),
    isPrivate: Number(Boolean(isPrivate))
  };

  getDb().prepare('INSERT INTO rooms (id, name, description, createdBy, createdAt, isPrivate) VALUES (?, ?, ?, ?, ?, ?)').run(
    room.id,
    room.name,
    room.description,
    room.createdBy,
    room.createdAt,
    room.isPrivate
  );

  return room;
}

function addMessage({ roomId, userId, username, text }) {
  const message = {
    id: crypto.randomUUID(),
    roomId,
    userId,
    username,
    text: String(text).slice(0, 4000),
    createdAt: new Date().toISOString(),
    deleted: 0
  };

  getDb().prepare('INSERT INTO messages (id, roomId, userId, username, text, createdAt, deleted) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    message.id,
    message.roomId,
    message.userId,
    message.username,
    message.text,
    message.createdAt,
    message.deleted
  );

  return message;
}

function getRoomMessages(roomId) {
  return getDb().prepare('SELECT * FROM messages WHERE roomId = ? AND deleted = 0 ORDER BY createdAt ASC LIMIT 200').all(roomId);
}

function setUserRole(userId, role) {
  getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  return findUserById(userId);
}

function setUserStatus(userId, status) {
  getDb().prepare('UPDATE users SET status = ?, lastSeen = ? WHERE id = ?').run(status, new Date().toISOString(), userId);
  return findUserById(userId);
}

function isUserBanned(userId) {
  const row = getDb().prepare('SELECT * FROM bans WHERE userId = ? ORDER BY createdAt DESC LIMIT 1').get(userId);
  if (!row) return false;
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    getDb().prepare('DELETE FROM bans WHERE userId = ?').run(userId);
    return false;
  }
  return true;
}

function banUser({ userId, reason = 'Violation', bannedBy }) {
  const id = crypto.randomUUID();
  getDb().prepare('INSERT INTO bans (id, userId, reason, bannedBy, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    userId,
    reason,
    bannedBy,
    new Date().toISOString(),
    null
  );
  setUserStatus(userId, 'banned');
  return { userId, reason, bannedBy };
}

function unbanUser(userId) {
  getDb().prepare('DELETE FROM bans WHERE userId = ?').run(userId);
  setUserStatus(userId, 'active');
}

function getAdminOverview() {
  const users = getUsers();
  const rooms = getRooms();
  const totalMessages = getDb().prepare('SELECT COUNT(*) AS count FROM messages WHERE deleted = 0').get().count;
  return {
    users: users.length,
    rooms: rooms.length,
    admins: users.filter((user) => user.role === 'admin').length,
    moderators: users.filter((user) => user.role === 'moderator').length,
    activeUsers: users.filter((user) => user.status === 'active').length,
    bannedUsers: users.filter((user) => user.status === 'banned').length,
    totalMessages
  };
}

module.exports = {
  initDatabase,
  getDb,
  getUsers,
  getRooms,
  getRoomById,
  getRoomByName,
  createUser,
  findUserByUsername,
  findUserById,
  verifyPassword,
  createRoom,
  addMessage,
  getRoomMessages,
  sanitizeText,
  setUserRole,
  setUserStatus,
  isUserBanned,
  banUser,
  unbanUser,
  getAdminOverview
};
