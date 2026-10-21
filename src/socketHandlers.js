const express = require('express');
const { authRequired, requireRole, sanitizeText, generateToken } = require('./auth');
const {
  createUser,
  findUserByUsername,
  verifyPassword,
  getUsers,
  getRooms,
  createRoom,
  getRoomById,
  getRoomMessages,
  addMessage,
  findUserById,
  setUserRole,
  banUser,
  unbanUser,
  getAdminOverview,
  isUserBanned
} = require('./db');

function safeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function createApiRouter(io) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ ok: true, message: 'sqour-arb is running' });
  });

  router.post('/auth/register', (req, res) => {
    try {
      const username = sanitizeText(req.body.username || '', '');
      const password = String(req.body.password || '');
      const displayName = sanitizeText(req.body.displayName || username, username);

      if (!username || password.length < 4) {
        return res.status(400).json({ ok: false, message: 'Username and password are required (minimum 4 chars)' });
      }

      const user = createUser({ username, password, displayName, role: 'user' });
      const token = generateToken(user);
      res.status(201).json({ ok: true, token, user: safeUser(user) });
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

      if (isUserBanned(user.id)) {
        return res.status(403).json({ ok: false, message: 'This user is banned' });
      }

      const token = generateToken(user);
      res.json({ ok: true, token, user: safeUser(user) });
    } catch (error) {
      res.status(400).json({ ok: false, message: error.message || 'Login failed' });
    }
  });

  router.get('/users/me', authRequired, (req, res) => {
    res.json({ ok: true, user: safeUser(req.user) });
  });

  router.get('/users', authRequired, requireRole('admin'), (req, res) => {
    res.json({ ok: true, users: getUsers().map(safeUser) });
  });

  router.get('/users/:userId', authRequired, (req, res) => {
    const user = findUserById(req.params.userId);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    res.json({ ok: true, user: safeUser(user) });
  });

  router.patch('/users/:userId/role', authRequired, requireRole('admin'), (req, res) => {
    const user = findUserById(req.params.userId);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const role = sanitizeText(req.body.role || '', '');
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ ok: false, message: 'Invalid role' });
    }

    const updated = setUserRole(user.id, role);
    io.emit('user-role-updated', { user: safeUser(updated), role });
    res.json({ ok: true, user: safeUser(updated) });
  });

  router.post('/users/:userId/ban', authRequired, requireRole('admin'), (req, res) => {
    const user = findUserById(req.params.userId);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const reason = sanitizeText(req.body.reason || 'Violation', 'Violation');
    const result = banUser({ userId: user.id, reason, bannedBy: req.user.id });

    io.emit('user-banned', {
      userId: user.id,
      user: safeUser(user),
      reason,
      bannedBy: req.user.id
    });

    res.json({ ok: true, message: 'User banned', item: result });
  });

  router.post('/users/:userId/unban', authRequired, requireRole('admin'), (req, res) => {
    const user = findUserById(req.params.userId);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    unbanUser(user.id);
    io.emit('user-unbanned', { userId: user.id });
    res.json({ ok: true, message: 'User unbanned' });
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
      io.emit('room-created', room);
      res.status(201).json({ ok: true, room });
    } catch (error) {
      res.status(400).json({ ok: false, message: error.message || 'Room creation failed' });
    }
  });

  router.get('/rooms/:roomId/messages', authRequired, (req, res) => {
    const room = getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });
    res.json({ ok: true, room, messages: getRoomMessages(room.id) });
  });

  router.post('/rooms/:roomId/messages', authRequired, (req, res) => {
    const room = getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });

    const text = sanitizeText(req.body.text || '', '');
    if (!text) return res.status(400).json({ ok: false, message: 'Message text is required' });

    const message = addMessage({
      roomId: room.id,
      userId: req.user.id,
      username: req.user.username,
      text
    });

    io.to(room.id).emit('new-message', {
      ...message,
      user: { id: req.user.id, username: req.user.username, displayName: req.user.displayName, role: req.user.role }
    });

    res.status(201).json({ ok: true, message });
  });

  router.get('/admin/overview', authRequired, requireRole('admin'), (req, res) => {
    res.json({ ok: true, stats: getAdminOverview() });
  });

  return router;
}

module.exports = { createApiRouter };
