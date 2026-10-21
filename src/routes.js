const express = require('express');
const { authRequired, sanitizeText } = require('./auth');
const {
  findUserByUsername,
  createUser,
  verifyPassword,
  getUsers,
  getRooms,
  createRoom,
  getRoomById,
  getRoomMessages,
  addMessage,
  findUserById
} = require('./db');

const router = express.Router();

function safeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, token, ...safe } = user;
  return safe;
}

router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'sqour-arb is running' });
});

router.post('/auth/register', async (req, res) => {
  try {
    const username = sanitizeText(req.body.username || '', '');
    const password = String(req.body.password || '');
    const displayName = sanitizeText(req.body.displayName || username, username);

    if (!username || password.length < 4) {
      return res.status(400).json({ ok: false, message: 'Username and password are required (minimum 4 chars)' });
    }

    const user = createUser({ username, password, displayName });
    res.status(201).json({ ok: true, user: safeUser(user) });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || 'Registration failed' });
  }
});

router.post('/auth/login', (req, res) => {
  try {
    const username = sanitizeText(req.body.username || '', '');
    const password = String(req.body.password || '');
    const user = findUserByUsername(username);

    if (!user || !verifyPassword(user, password)) {
      return res.status(401).json({ ok: false, message: 'Invalid username or password' });
    }

    res.json({
      ok: true,
      token: user.token,
      user: safeUser(user)
    });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || 'Login failed' });
  }
});

router.get('/users/me', authRequired, (req, res) => {
  res.json({ ok: true, user: safeUser(req.user) });
});

router.get('/users', authRequired, (req, res) => {
  res.json({ ok: true, users: getUsers().map(safeUser) });
});

router.get('/users/:userId', authRequired, (req, res) => {
  const user = findUserById(req.params.userId);
  if (!user) {
    return res.status(404).json({ ok: false, message: 'User not found' });
  }
  res.json({ ok: true, user: safeUser(user) });
});

router.get('/rooms', authRequired, (req, res) => {
  res.json({ ok: true, rooms: getRooms() });
});

router.post('/rooms', authRequired, (req, res) => {
  try {
    const room = createRoom({
      name: req.body.name,
      description: req.body.description || '',
      createdBy: req.user.id,
      isPrivate: Boolean(req.body.isPrivate)
    });
    res.status(201).json({ ok: true, room });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || 'Room creation failed' });
  }
});

router.get('/rooms/:roomId/messages', authRequired, (req, res) => {
  const room = getRoomById(req.params.roomId);
  if (!room) {
    return res.status(404).json({ ok: false, message: 'Room not found' });
  }

  res.json({ ok: true, room, messages: getRoomMessages(room.id) });
});

router.post('/rooms/:roomId/messages', authRequired, (req, res) => {
  const room = getRoomById(req.params.roomId);
  if (!room) {
    return res.status(404).json({ ok: false, message: 'Room not found' });
  }

  const text = sanitizeText(req.body.text || '', '');
  if (!text) {
    return res.status(400).json({ ok: false, message: 'Message text is required' });
  }

  const message = addMessage({
    roomId: room.id,
    userId: req.user.id,
    username: req.user.username,
    text
  });

  res.status(201).json({ ok: true, message });
});

module.exports = router;
