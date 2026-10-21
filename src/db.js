const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { DATA_DIR } = require('./config');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) {
      return fallback;
    }
    return JSON.parse(content);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function ensureSeedData() {
  const users = readJson(USERS_FILE, []);
  const rooms = readJson(ROOMS_FILE, [
    {
      id: 'general',
      name: 'الرئيسية',
      description: 'غرفة عامة',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      isPrivate: false
    }
  ]);
  const messages = readJson(MESSAGES_FILE, [
    {
      id: 'welcome-message',
      roomId: 'general',
      userId: 'system',
      username: 'system',
      text: 'مرحباً بك في sqour-arb، ابدأ المحادثة الآن.',
      createdAt: new Date().toISOString()
    }
  ]);

  if (!users.length) {
    writeJson(USERS_FILE, users);
  }
  if (!rooms.length) {
    writeJson(ROOMS_FILE, rooms);
  }
  if (!messages.length) {
    writeJson(MESSAGES_FILE, messages);
  }
}

function getUsers() {
  ensureSeedData();
  return readJson(USERS_FILE, []);
}

function getRooms() {
  ensureSeedData();
  return readJson(ROOMS_FILE, []);
}

function getMessages() {
  ensureSeedData();
  return readJson(MESSAGES_FILE, []);
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function saveRooms(rooms) {
  writeJson(ROOMS_FILE, rooms);
}

function saveMessages(messages) {
  writeJson(MESSAGES_FILE, messages);
}

function findUserByUsername(username) {
  return getUsers().find((user) => user.username.toLowerCase() === String(username).toLowerCase());
}

function findUserById(userId) {
  return getUsers().find((user) => user.id === userId) || null;
}

function findUserByToken(token) {
  return getUsers().find((user) => user.token === token) || null;
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function createUserRecord({ username, password, displayName, role = 'user' }) {
  const salt = makeSalt();
  const user = {
    id: crypto.randomUUID(),
    username: String(username).trim(),
    displayName: String(displayName || username).trim(),
    passwordHash: hashPassword(String(password), salt),
    salt,
    role,
    token: crypto.randomBytes(32).toString('hex'),
    createdAt: new Date().toISOString(),
    isActive: true
  };
  return user;
}

function createUser({ username, password, displayName, role = 'user' }) {
  const users = getUsers();
  if (findUserByUsername(username)) {
    throw new Error('Username already exists');
  }

  const user = createUserRecord({ username, password, displayName, role });
  users.push(user);
  saveUsers(users);
  return { ...user, passwordHash: undefined, salt: undefined };
}

function verifyPassword(user, password) {
  return user.passwordHash === hashPassword(String(password), user.salt);
}

function createRoom({ name, description = '', createdBy, isPrivate = false }) {
  const rooms = getRooms();
  const targetName = String(name).trim();
  if (!targetName) {
    throw new Error('Room name is required');
  }

  if (rooms.some((room) => room.name.toLowerCase() === targetName.toLowerCase())) {
    throw new Error('Room already exists');
  }

  const room = {
    id: crypto.randomUUID(),
    name: targetName,
    description: String(description).trim(),
    createdBy,
    createdAt: new Date().toISOString(),
    isPrivate: Boolean(isPrivate)
  };

  rooms.push(room);
  saveRooms(rooms);
  return room;
}

function addMessage({ roomId, userId, username, text }) {
  const messages = getMessages();
  const message = {
    id: crypto.randomUUID(),
    roomId,
    userId,
    username,
    text: String(text).slice(0, 2000),
    createdAt: new Date().toISOString()
  };

  messages.push(message);
  saveMessages(messages);
  return message;
}

function getRoomMessages(roomId) {
  return getMessages().filter((message) => message.roomId === roomId).slice(-100);
}

function getRoomById(roomId) {
  return getRooms().find((room) => room.id === roomId || room.name === roomId) || null;
}

module.exports = {
  getUsers,
  getRooms,
  getMessages,
  findUserByUsername,
  findUserById,
  findUserByToken,
  createUser,
  verifyPassword,
  createRoom,
  addMessage,
  getRoomMessages,
  getRoomById,
  ensureSeedData
};
