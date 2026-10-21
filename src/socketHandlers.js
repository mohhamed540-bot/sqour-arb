const chatStore = require('./chatStore');
const { DEFAULT_ROOM } = require('./config');

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, 200) : fallback;
}

function sanitizeColor(value, fallback = '#ffffff') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const color = value.trim();
  return /^#[0-9A-Fa-f]{3,8}$/.test(color) ? color : fallback;
}

function buildUser(socket, profile = {}) {
  const baseName = sanitizeText(profile.topic || profile.name || 'حسان', 'حسان');
  const room = sanitizeText(profile.room || DEFAULT_ROOM, DEFAULT_ROOM);
  const color = sanitizeColor(profile.ucol || profile.color || profile.col || '#ffff', '#ffff');

  return {
    id: socket.id,
    name: baseName,
    topic: baseName,
    pic: sanitizeText(profile.pic || '/pic/1790799452089.png.webp', '/pic/1790799452089.png.webp'),
    ico: sanitizeText(profile.ico || '', ''),
    co: sanitizeText(profile.co || 'ye', 'ye'),
    room,
    power: String(profile.power || '5'),
    col: color,
    ucol: color,
    color,
    mcol: sanitizeColor(profile.mcol || '#1a1aff', '#1a1aff'),
    bg: sanitizeText(profile.bg || '#FFFFFF', '#FFFFFF')
  };
}

function emitPresence(io, room, type) {
  io.to(room).emit('presence', {
    type,
    room,
    users: chatStore.getRoomUsers(room)
  });
}

function registerSocket(io, socket) {
  const initialUser = buildUser(socket, {
    room: DEFAULT_ROOM,
    topic: 'حسان'
  });

  chatStore.setUser(socket.id, initialUser);
  chatStore.addUserToRoom(initialUser.room, initialUser);
  socket.data.user = initialUser;
  socket.data.room = initialUser.room;
  socket.join(initialUser.room);

  socket.emit('system', {
    type: 'welcome',
    message: 'تم الاتصال بنجاح',
    user: initialUser
  });

  emitPresence(io, initialUser.room, 'join');

  socket.on('join-room', (roomName) => {
    const nextRoom = sanitizeText(roomName, DEFAULT_ROOM);
    const previousRoom = socket.data.room || DEFAULT_ROOM;

    if (previousRoom && previousRoom !== nextRoom && socket.rooms.has(previousRoom)) {
      socket.leave(previousRoom);
      chatStore.removeUserFromRoom(previousRoom, socket.id);
    }

    const user = chatStore.getUser(socket.id) || buildUser(socket, { room: nextRoom });
    user.room = nextRoom;
    user.name = sanitizeText(user.name || 'حسان', 'حسان');
    user.topic = user.name;

    socket.data.user = user;
    socket.data.room = nextRoom;
    chatStore.setUser(socket.id, user);
    chatStore.addUserToRoom(nextRoom, user);
    socket.join(nextRoom);

    socket.emit('system', {
      type: 'room-changed',
      room: nextRoom,
      message: `تمت الإضافة إلى الغرفة: ${nextRoom}`
    });

    emitPresence(io, nextRoom, 'join');
  });

  socket.on('SEND_EVENT_EMIT_SERVER', (packet, callback) => {
    try {
      if (!packet || !packet.cmd) {
        if (typeof callback === 'function') {
          callback({ err: 1, status: 'error', msg: 'Invalid packet' });
        }
        return;
      }

      if (packet.cmd === 'WetchTop') {
        const payload = {
          cmd: 'WetchTop',
          data: chatStore.getTopUsers(10)
        };

        if (typeof callback === 'function') {
          callback(payload);
          return;
        }

        socket.emit('SEND_EVENT_EMIT_SERVER', payload);
        return;
      }

      const baseProfile = typeof packet.data === 'object' && packet.data ? packet.data : {};
      const currentUser = chatStore.getUser(socket.id) || buildUser(socket, baseProfile);
      const mergedUser = {
        ...currentUser,
        ...buildUser(socket, {
          ...currentUser,
          ...baseProfile,
          room: socket.data.room || currentUser.room || DEFAULT_ROOM
        })
      };

      if (packet.cmd === 'SEND_EVENT_EMIT_PROFILE') {
        mergedUser.topic = sanitizeText(baseProfile.topic || baseProfile.name || mergedUser.topic, mergedUser.topic);
        mergedUser.name = mergedUser.topic;
        mergedUser.color = sanitizeColor(baseProfile.ucol || baseProfile.color || baseProfile.col || mergedUser.color, mergedUser.color);
        mergedUser.ucol = mergedUser.color;
        mergedUser.col = mergedUser.color;
        mergedUser.bg = sanitizeText(baseProfile.bg || mergedUser.bg, mergedUser.bg);
        mergedUser.pic = sanitizeText(baseProfile.pic || mergedUser.pic, mergedUser.pic);
        mergedUser.room = sanitizeText(baseProfile.room || socket.data.room || mergedUser.room, DEFAULT_ROOM);

        chatStore.setUser(socket.id, mergedUser);
        socket.data.user = mergedUser;
        socket.data.room = mergedUser.room;

        if (mergedUser.room && !socket.rooms.has(mergedUser.room)) {
          socket.join(mergedUser.room);
        }

        io.to(mergedUser.room).emit('presence', {
          type: 'profile-updated',
          room: mergedUser.room,
          user: mergedUser,
          users: chatStore.getRoomUsers(mergedUser.room)
        });
      }

      const senderUser = chatStore.getUser(socket.id) || mergedUser;
      const roomToEmit = senderUser.room || socket.data.room || DEFAULT_ROOM;

      if (typeof callback === 'function') {
        callback({ err: 0, status: 'ok', msg: 'success' });
      }

      const responsePacket = {
        cmd: packet.cmd,
        id: socket.id,
        user: senderUser,
        data: packet.data || {},
        time: new Date().toLocaleTimeString('ar-SA')
      };

      io.to(roomToEmit).emit('SEND_EVENT_EMIT_SERVER', responsePacket);
      io.to(roomToEmit).emit('RECEIVE_EVENT', responsePacket);
      io.to(roomToEmit).emit('message', responsePacket);
    } catch (error) {
      console.error('Socket event error:', error);
      if (typeof callback === 'function') {
        callback({ err: 1, status: 'error', msg: 'Internal server error' });
      }
    }
  });

  socket.on('disconnect', () => {
    const currentUser = chatStore.getUser(socket.id);
    const currentRoom = socket.data.room || currentUser?.room || DEFAULT_ROOM;

    if (currentUser) {
      chatStore.removeUserFromRoom(currentRoom, socket.id);
      chatStore.deleteUser(socket.id);
    }

    emitPresence(io, currentRoom, 'leave');
    console.log('❌ [انقطع الاتصال]:', socket.id);
  });
}

module.exports = {
  registerSocket,
  buildUser,
  sanitizeText,
  sanitizeColor
};
