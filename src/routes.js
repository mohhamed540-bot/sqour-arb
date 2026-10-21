const { DEFAULT_ROOM } = require('./config');
const { findUserById, findUserByToken, getRoomById, addMessage, getRoomMessages } = require('./db');

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
}

function buildPresencePayload(io, roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  const members = room ? [...room] : [];
  return {
    roomId,
    members: members.map((socketId) => ({ socketId }))
  };
}

function registerSocket(io, socket) {
  socket.on('auth', (payload = {}) => {
    const token = payload.token || payload.authorization || '';
    const user = findUserByToken(token);

    if (!user) {
      socket.emit('auth_error', { message: 'Invalid token' });
      socket.disconnect(true);
      return;
    }

    socket.user = user;
    socket.join(DEFAULT_ROOM);
    socket.emit('auth_ok', {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      },
      roomId: DEFAULT_ROOM
    });

    io.emit('presence', {
      type: 'online',
      user: { id: user.id, username: user.username },
      roomId: DEFAULT_ROOM
    });
  });

  socket.on('join-room', (roomId) => {
    if (!socket.user) {
      socket.emit('error', { message: 'Please authenticate first' });
      return;
    }

    const room = getRoomById(roomId || DEFAULT_ROOM);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    socket.join(room.id);
    const history = getRoomMessages(room.id);
    socket.emit('room-history', { roomId: room.id, messages: history });
    io.to(room.id).emit('presence', {
      type: 'join',
      roomId: room.id,
      user: {
        id: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.displayName
      }
    });
  });

  socket.on('send-message', ({ roomId, text }) => {
    if (!socket.user) {
      socket.emit('error', { message: 'Please authenticate first' });
      return;
    }

    const room = getRoomById(roomId || DEFAULT_ROOM);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const cleanText = sanitizeText(text, '');
    if (!cleanText) {
      socket.emit('error', { message: 'Message text is required' });
      return;
    }

    const message = addMessage({
      roomId: room.id,
      userId: socket.user.id,
      username: socket.user.username,
      text: cleanText
    });

    io.to(room.id).emit('new-message', {
      ...message,
      user: {
        id: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.displayName,
        role: socket.user.role
      }
    });
  });

  socket.on('typing', ({ roomId, isTyping = true }) => {
    if (!socket.user) return;
    const room = getRoomById(roomId || DEFAULT_ROOM);
    if (!room) return;

    socket.to(room.id).emit('typing', {
      userId: socket.user.id,
      username: socket.user.username,
      roomId: room.id,
      isTyping
    });
  });

  socket.on('disconnect', () => {
    if (socket.user) {
      io.emit('presence', {
        type: 'offline',
        user: { id: socket.user.id, username: socket.user.username }
      });
    }
  });
}

module.exports = {
  registerSocket,
  sanitizeText
};
