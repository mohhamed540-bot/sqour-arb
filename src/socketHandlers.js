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
  isUserBanned,
  getUserProfile,
  updateUserProfile,
  editMessage,
  deleteMessage,
  toggleMessageReaction,
  getMessageReactions,
  getRoomMembers,
  ensureRoomMember
} = require('./db');

function safeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return {
    ...safe,
    profile: getUserProfile(user.id) || {
      id: null,
      userId: user.id,
      bio: '',
      avatar: user.avatar || '',
      themeColor: user.themeColor || '#60a5fa',
      updatedAt: new Date().toISOString()
    }
  };
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

  router.get('/users/me/profile', authRequired, (req, res) => {
    res.json({ ok: true, profile: getUserProfile(req.user.id) });
  });

  router.patch('/users/me/profile', authRequired, (req, res) => {
    try {
      const profile = updateUserProfile(req.user.id, {
        bio: req.body.bio,
        avatar: req.body.avatar,
        themeColor: req.body.themeColor
      });
      res.json({ ok: true, profile });
    } catch (error) {
      res.status(400).json({ ok: false, message: error.message || 'Profile update failed' });
    }
  });

  router.get('/users', authRequired, requireRole('admin'), (req, res) => {
    const search = String(req.query.search || '');
    res.json({ ok: true, users: getUsers(search).map(safeUser) });
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
    const search = String(req.query.search || '');
    res.json({ ok: true, rooms: getRooms(search) });
  });

  router.post('/rooms', authRequired, (req, res) => {
    try {
      const room = createRoom({
        name: req.body.name,
        description: req.body.description || '',
        createdBy: req.user.id,
        isPrivate: Boolean(req.body.isPrivate),
        coverImage: req.body.coverImage || null
      });
      io.emit('room-created', room);
      res.status(201).json({ ok: true, room });
    } catch (error) {
      res.status(400).json({ ok: false, message: error.message || 'Room creation failed' });
    }
  });

  router.get('/rooms/:roomId/members', authRequired, (req, res) => {
    const room = getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });
    res.json({ ok: true, members: getRoomMembers(room.id) });
  });

  router.get('/rooms/:roomId/messages', authRequired, (req, res) => {
    const room = getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });

    const search = String(req.query.search || '');
    const messages = getRoomMessages(room.id, search);
    const normalized = messages.map((message) => ({
      ...message,
      reactions: getMessageReactions(message.id)
    }));

    res.json({ ok: true, room, messages: normalized });
  });

  router.post('/rooms/:roomId/messages', authRequired, (req, res) => {
    const room = getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });

    const text = sanitizeText(req.body.text || '', '');
    if (!text) return res.status(400).json({ ok: false, message: 'Message text is required' });

    const replyTo = req.body.replyTo || null;
    const message = addMessage({
      roomId: room.id,
      userId: req.user.id,
      username: req.user.username,
      text,
      replyTo
    });

    ensureRoomMember(room.id, req.user.id);

    const payload = {
      ...message,
      reactions: [],
      user: { id: req.user.id, username: req.user.username, displayName: req.user.displayName, role: req.user.role, avatar: req.user.avatar }
    };

    io.to(room.id).emit('new-message', payload);
    res.status(201).json({ ok: true, message: payload });
  });

  router.patch('/rooms/:roomId/messages/:messageId', authRequired, (req, res) => {
    const room = getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });

    const message = getRoomMessages(room.id).find((item) => item.id === req.params.messageId);
    if (!message) return res.status(404).json({ ok: false, message: 'Message not found' });

    const canEdit = message.userId === req.user.id || ['admin', 'moderator'].includes(req.user.role);
    if (!canEdit) return res.status(403).json({ ok: false, message: 'You cannot edit this message' });

    const text = sanitizeText(req.body.text || '', '');
    if (!text) return res.status(400).json({ ok: false, message: 'Message text is required' });

    const updated = editMessage(message.id, text);
    const payload = {
      ...updated,
      reactions: getMessageReactions(updated.id),
      user: { id: req.user.id, username: req.user.username, displayName: req.user.displayName, role: req.user.role }
    };

    io.to(room.id).emit('message-edited', { roomId: room.id, message: payload });
    res.json({ ok: true, message: payload });
  });

  router.delete('/rooms/:roomId/messages/:messageId', authRequired, (req, res) => {
    const room = getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });

    const message = getRoomMessages(room.id).find((item) => item.id === req.params.messageId);
    if (!message) return res.status(404).json({ ok: false, message: 'Message not found' });

    const canDelete = message.userId === req.user.id || ['admin', 'moderator'].includes(req.user.role);
    if (!canDelete) return res.status(403).json({ ok: false, message: 'You cannot delete this message' });

    const deleted = deleteMessage(message.id);
    io.to(room.id).emit('message-deleted', { roomId: room.id, messageId: message.id, message: deleted });
    res.json({ ok: true, messageId: message.id });
  });

  router.post('/rooms/:roomId/messages/:messageId/react', authRequired, (req, res) => {
    const room = getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });

    const message = getRoomMessages(room.id).find((item) => item.id === req.params.messageId);
    if (!message) return res.status(404).json({ ok: false, message: 'Message not found' });

    const emoji = sanitizeText(String(req.body.emoji || ''), '');
    if (!emoji) return res.status(400).json({ ok: false, message: 'Emoji is required' });

    const result = toggleMessageReaction({ messageId: message.id, userId: req.user.id, emoji });
    const reactions = getMessageReactions(message.id);

    io.to(room.id).emit('message-reacted', {
      roomId: room.id,
      messageId: message.id,
      reactions,
      action: result.action,
      emoji: result.emoji,
      userId: req.user.id
    });

    res.json({ ok: true, reactions, action: result.action, emoji: result.emoji });
  });

  router.get('/admin/overview', authRequired, requireRole('admin'), (req, res) => {
    res.json({ ok: true, stats: getAdminOverview() });
  });

  return router;
}

module.exports = { createApiRouter };
