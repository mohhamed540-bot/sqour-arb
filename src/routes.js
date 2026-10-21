const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { DATA_DIR, DEFAULT_ROOM } = require('./config');

let db;

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

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
      lastSeen TEXT,
      avatar TEXT,
      bio TEXT,
      themeColor TEXT
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      bio TEXT,
      avatar TEXT,
      themeColor TEXT,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      isPrivate INTEGER DEFAULT 0,
      coverImage TEXT
    );

    CREATE TABLE IF NOT EXISTS room_members (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      joinedAt TEXT NOT NULL,
      UNIQUE(roomId, userId)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      editedAt TEXT,
      deleted INTEGER DEFAULT 0,
      replyTo TEXT
    );

    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      emoji TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(messageId, userId, emoji)
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

  ensureColumn('messages', 'editedAt', 'TEXT');
  ensureColumn('messages', 'replyTo', 'TEXT');
  ensureColumn('rooms', 'coverImage', 'TEXT');
  ensureColumn('users', 'avatar', 'TEXT');
  ensureColumn('users', 'bio', 'TEXT');
  ensureColumn('users', 'themeColor', 'TEXT');

  const roomCount = db.prepare('SELECT COUNT(*) AS count FROM rooms').get().count;
  if (roomCount === 0) {
    db.prepare('INSERT INTO rooms (id, name, description, createdBy, createdAt, isPrivate, coverImage) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'general',
      DEFAULT_ROOM,
      'غرفة عامة',
      'system',
      new Date().toISOString(),
      0,
      null
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
      lastSeen: new Date().toISOString(),
      avatar: 'https://ui-avatars.com/api/?name=Admin&background=0ea5e9&color=fff',
      bio: 'مدير النظام',
      themeColor: '#2563eb'
    };

    db.prepare('INSERT INTO users (id, username, displayName, passwordHash, role, status, createdAt, lastSeen, avatar, bio, themeColor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      adminUser.id,
      adminUser.username,
      adminUser.displayName,
      adminUser.passwordHash,
      adminUser.role,
      adminUser.status,
      adminUser.createdAt,
      adminUser.lastSeen,
      adminUser.avatar,
      adminUser.bio,
      adminUser.themeColor
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

function getUsers(search = '') {
  const term = search ? `%${String(search).trim()}%` : null;
  if (!term) return getDb().prepare('SELECT * FROM users ORDER BY createdAt DESC').all();
  return getDb().prepare('SELECT * FROM users WHERE username LIKE ? OR displayName LIKE ? ORDER BY createdAt DESC').all(term, term);
}

function getRooms(search = '') {
  const term = search ? `%${String(search).trim()}%` : null;
  if (!term) return getDb().prepare('SELECT * FROM rooms ORDER BY createdAt DESC').all();
  return getDb().prepare('SELECT * FROM rooms WHERE name LIKE ? OR description LIKE ? ORDER BY createdAt DESC').all(term, term);
}

function getRoomById(roomId) {
  return getDb().prepare('SELECT * FROM rooms WHERE id = ? OR name = ?').get(roomId, roomId) || null;
}

function getRoomByName(name) {
  return getDb().prepare('SELECT * FROM rooms WHERE name = ?').get(name) || null;
}

function getRoomMembers(roomId) {
  return getDb().prepare(`
    SELECT u.*
    FROM room_members rm
    INNER JOIN users u ON u.id = rm.userId
    WHERE rm.roomId = ?
    ORDER BY rm.joinedAt ASC
  `).all(roomId);
}

function ensureRoomMember(roomId, userId) {
  const existing = getDb().prepare('SELECT id FROM room_members WHERE roomId = ? AND userId = ?').get(roomId, userId);
  if (existing) return existing;

  const id = crypto.randomUUID();
  getDb().prepare('INSERT INTO room_members (id, roomId, userId, joinedAt) VALUES (?, ?, ?, ?)').run(
    id,
    roomId,
    userId,
    new Date().toISOString()
  );

  return { id, roomId, userId };
}

function createUser({ username, password, displayName, role = 'user' }) {
  const cleanUsername = sanitizeText(username, '');
  if (!cleanUsername) throw new Error('Username is required');
  if (String(password).length < 4) throw new Error('Password must be at least 4 characters');

  const existing = getDb().prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
  if (existing) throw new Error('Username already exists');

  const user = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    displayName: sanitizeText(displayName || cleanUsername, cleanUsername),
    passwordHash: bcrypt.hashSync(String(password), 10),
    role,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanUsername)}&background=0ea5e9&color=fff`,
    bio: '',
    themeColor: '#60a5fa'
  };

  getDb().prepare('INSERT INTO users (id, username, displayName, passwordHash, role, status, createdAt, lastSeen, avatar, bio, themeColor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    user.id,
    user.username,
    user.displayName,
    user.passwordHash,
    user.role,
    user.status,
    user.createdAt,
    user.lastSeen,
    user.avatar,
    user.bio,
    user.themeColor
  );

  getDb().prepare('INSERT INTO profiles (id, userId, bio, avatar, themeColor, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    user.id,
    user.bio,
    user.avatar,
    user.themeColor,
    user.createdAt
  );

  return user;
}

function findUserByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username) || null;
}

function findUserById(userId) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
}

function verifyPassword(user, password) {
  if (!user) return false;
  return bcrypt.compareSync(String(password), user.passwordHash);
}

function createRoom({ name, description = '', createdBy, isPrivate = false, coverImage = null }) {
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
    isPrivate: Number(Boolean(isPrivate)),
    coverImage: coverImage || null
  };

  getDb().prepare('INSERT INTO rooms (id, name, description, createdBy, createdAt, isPrivate, coverImage) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    room.id,
    room.name,
    room.description,
    room.createdBy,
    room.createdAt,
    room.isPrivate,
    room.coverImage
  );

  if (createdBy) {
    ensureRoomMember(room.id, createdBy);
  }

  return room;
}

function addMessage({ roomId, userId, username, text, replyTo = null }) {
  const message = {
    id: crypto.randomUUID(),
    roomId,
    userId,
    username,
    text: String(text).slice(0, 4000),
    createdAt: new Date().toISOString(),
    editedAt: null,
    deleted: 0,
    replyTo: replyTo || null
  };

  getDb().prepare('INSERT INTO messages (id, roomId, userId, username, text, createdAt, editedAt, deleted, replyTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    message.id,
    message.roomId,
    message.userId,
    message.username,
    message.text,
    message.createdAt,
    message.editedAt,
    message.deleted,
    message.replyTo
  );

  ensureRoomMember(roomId, userId);
  return message;
}

function getMessageById(messageId) {
  return getDb().prepare('SELECT * FROM messages WHERE id = ?').get(messageId) || null;
}

function getRoomMessages(roomId, search = '') {
  const term = search ? `%${String(search).trim()}%` : null;
  if (!term) {
    return getDb().prepare('SELECT * FROM messages WHERE roomId = ? AND deleted = 0 ORDER BY createdAt ASC LIMIT 200').all(roomId);
  }
  return getDb().prepare('SELECT * FROM messages WHERE roomId = ? AND deleted = 0 AND (text LIKE ? OR username LIKE ?) ORDER BY createdAt ASC LIMIT 200').all(roomId, term, term);
}

function editMessage(messageId, text) {
  const cleanText = String(text || '').trim();
  if (!cleanText) throw new Error('Message text is required');
  getDb().prepare('UPDATE messages SET text = ?, editedAt = ? WHERE id = ?').run(cleanText, new Date().toISOString(), messageId);
  return getMessageById(messageId);
}

function deleteMessage(messageId) {
  getDb().prepare('UPDATE messages SET deleted = 1 WHERE id = ?').run(messageId);
  return getMessageById(messageId);
}

function getUserProfile(userId) {
  const direct = getDb().prepare('SELECT * FROM profiles WHERE userId = ?').get(userId);
  if (direct) return direct;

  const user = findUserById(userId);
  if (!user) return null;

  const profile = {
    id: crypto.randomUUID(),
    userId: user.id,
    bio: user.bio || '',
    avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0ea5e9&color=fff`,
    themeColor: user.themeColor || '#60a5fa',
    updatedAt: new Date().toISOString()
  };

  getDb().prepare('INSERT INTO profiles (id, userId, bio, avatar, themeColor, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    profile.id,
    profile.userId,
    profile.bio,
    profile.avatar,
    profile.themeColor,
    profile.updatedAt
  );

  return profile;
}

function updateUserProfile(userId, { bio = '', avatar = '', themeColor = '#60a5fa' }) {
  const profile = getUserProfile(userId) || {
    id: crypto.randomUUID(),
    userId,
    bio: '',
    avatar: '',
    themeColor: '#60a5fa',
    updatedAt: new Date().toISOString()
  };

  const safeBio = sanitizeText(String(bio || ''), '');
  const safeAvatar = sanitizeText(String(avatar || ''), '');
  const safeColor = sanitizeText(String(themeColor || '#60a5fa'), '#60a5fa');

  const next = {
    ...profile,
    bio: safeBio,
    avatar: safeAvatar || profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(findUserById(userId)?.username || 'User')}&background=0ea5e9&color=fff`,
    themeColor: safeColor,
    updatedAt: new Date().toISOString()
  };

  getDb().prepare('INSERT INTO profiles (id, userId, bio, avatar, themeColor, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(userId) DO UPDATE SET bio = excluded.bio, avatar = excluded.avatar, themeColor = excluded.themeColor, updatedAt = excluded.updatedAt').run(
    next.id,
    userId,
    next.bio,
    next.avatar,
    next.themeColor,
    next.updatedAt
  );

  getDb().prepare('UPDATE users SET avatar = ?, bio = ?, themeColor = ?, lastSeen = ? WHERE id = ?').run(
    next.avatar,
    next.bio,
    next.themeColor,
    new Date().toISOString(),
    userId
  );

  return next;
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

function toggleMessageReaction({ messageId, userId, emoji }) {
  const safeEmoji = sanitizeText(String(emoji || ''), '');
  if (!safeEmoji) throw new Error('Emoji is required');

  const existing = getDb().prepare('SELECT * FROM message_reactions WHERE messageId = ? AND userId = ? AND emoji = ?').get(messageId, userId, safeEmoji);
  if (existing) {
    getDb().prepare('DELETE FROM message_reactions WHERE id = ?').run(existing.id);
    return { action: 'removed', emoji: safeEmoji };
  }

  const record = {
    id: crypto.randomUUID(),
    messageId,
    userId,
    emoji: safeEmoji,
    createdAt: new Date().toISOString()
  };

  getDb().prepare('INSERT INTO message_reactions (id, messageId, userId, emoji, createdAt) VALUES (?, ?, ?, ?, ?)').run(
    record.id,
    record.messageId,
    record.userId,
    record.emoji,
    record.createdAt
  );

  return { action: 'added', emoji: safeEmoji };
}

function getMessageReactions(messageId) {
  return getDb().prepare('SELECT * FROM message_reactions WHERE messageId = ? ORDER BY createdAt ASC').all(messageId);
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
  getRoomMembers,
  ensureRoomMember,
  createUser,
  findUserByUsername,
  findUserById,
  verifyPassword,
  createRoom,
  addMessage,
  getMessageById,
  getRoomMessages,
  editMessage,
  deleteMessage,
  getUserProfile,
  updateUserProfile,
  sanitizeText,
  setUserRole,
  setUserStatus,
  isUserBanned,
  banUser,
  unbanUser,
  toggleMessageReaction,
  getMessageReactions,
  getAdminOverview
};
