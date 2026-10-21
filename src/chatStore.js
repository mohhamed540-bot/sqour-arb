class ChatStore {
  constructor() {
    this.users = new Map();
    this.rooms = new Map();
  }

  getUser(socketId) {
    return this.users.get(socketId) || null;
  }

  setUser(socketId, user) {
    this.users.set(socketId, user);
  }

  deleteUser(socketId) {
    this.users.delete(socketId);
  }

  getRoom(roomName) {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Map());
    }
    return this.rooms.get(roomName);
  }

  getRoomUsers(roomName) {
    const room = this.getRoom(roomName);
    return [...room.values()];
  }

  addUserToRoom(roomName, user) {
    const room = this.getRoom(roomName);
    room.set(user.id, user);
  }

  removeUserFromRoom(roomName, userId) {
    const room = this.rooms.get(roomName);
    if (!room) return;
    room.delete(userId);
    if (room.size === 0) {
      this.rooms.delete(roomName);
    }
  }

  getTopUsers(limit = 10) {
    const users = [...this.users.values()]
      .filter(user => user && user.topic)
      .sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));

    return users.slice(0, limit).map(user => ({
      id: user.id,
      name: user.name,
      topic: user.topic,
      power: user.power,
      room: user.room,
      pic: user.pic,
      color: user.color
    }));
  }
}

module.exports = new ChatStore();
