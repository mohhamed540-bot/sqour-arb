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
      role TEXT DEFAULT 'user',
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
      createdAt TEXT NOT NULL
    );
  `);

  const roomCount = db.prepare('SELECT COUNT(*) AS count FROM rooms').get().count;
  if (roomCount === 0) {
    db.prepare(`INSERT INTO rooms (id, name, description, createdBy, createdAt, isPrivate) VALUES (?, ?, ?, ?, ?, ?)`).run(
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
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
    db.prepare(`INSERT INTO users (id, username, displayName, passwordHash, role, createdAt, lastSeen) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      adminUser.id,
      adminUser.username,
      adminUser.displayName,
      adminUser.passwordHash,
      adminUser.role,
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
  const existing = getDb().prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) throw new Error('Username already exists');

  const user = {
    id: crypto.randomUUID(),
    username: sanitizeText(username, ''),
    displayName: sanitizeText(displayName || username, username),
    passwordHash: bcrypt.hashSync(String(password), 10),
    role,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };

  getDb().prepare(`INSERT INTO users (id, username, displayName, passwordHash, role, createdAt, lastSeen) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    user.id, user.username, user.displayName, user.passwordHash, user.role, user.createdAt, user.lastSeen
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

function createRoom({ name, description = '', createdBy }) {
  const roomName = sanitizeText(name, '');
  if (!roomName) throw new Error('Room name is required');

  const existing = getRoomByName(roomName);
  if (existing) throw new Error('Room already exists');

  const room = {
    id: crypto.randomUUID(),
    name: roomName,
    description: sanitizeText(description, ''),
    createdBy,
    createdAt: new Date().toISOString(),
    isPrivate: 0
  };

  getDb().prepare(`INSERT INTO rooms (id, name, description, createdBy, createdAt, isPrivate) VALUES (?, ?, ?, ?, ?, ?)`).run(
    room.id, room.name, room.description, room.createdBy, room.createdAt, room.isPrivate
  );

  return room;
}

function addMessage({ roomId, userId, username, text }) {
  const msg = {
    id: crypto.randomUUID(),
    roomId,
    userId,
    username,
    text: String(text).slice(0, 4000),
    createdAt: new Date().toISOString()
  };

  getDb().prepare(`INSERT INTO messages (id, roomId, userId, username, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(
    msg.id, msg.roomId, msg.userId, msg.username, msg.text, msg.createdAt
  );

  return msg;
}

function getRoomMessages(roomId) {
  return getDb().prepare('SELECT * FROM messages WHERE roomId = ? ORDER BY createdAt ASC LIMIT 200').all(roomId);
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
  sanitizeText
};
