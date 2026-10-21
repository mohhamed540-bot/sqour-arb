<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>sqour-arb | الدردشة</title>
    <style>
      :root {
        --bg: #020817;
        --panel: #111827;
        --panel-2: #1f2937;
        --line: #334155;
        --text: #e2e8f0;
        --muted: #94a3b8;
        --primary: #2563eb;
        --accent: #22c55e;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Tahoma, sans-serif;
        background: var(--bg);
        color: var(--text);
      }

      .app {
        display: flex;
        height: 100vh;
      }

      .sidebar {
        width: 290px;
        background: var(--panel);
        border-left: 1px solid var(--line);
        padding: 18px;
        overflow: auto;
      }

      .main {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .header {
        padding: 18px 20px;
        background: var(--panel-2);
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header .title {
        font-weight: bold;
        font-size: 1.05rem;
      }

      .messages {
        flex: 1;
        overflow: auto;
        padding: 18px;
        background: #0b1220;
      }

      .input-wrap {
        display: flex;
        gap: 10px;
        padding: 18px;
        background: var(--panel);
        border-top: 1px solid var(--line);
      }

      input, textarea, button {
        border-radius: 10px;
        padding: 12px;
        border: 1px solid var(--line);
        background: #0f172a;
        color: white;
        font: inherit;
      }

      textarea {
        min-height: 44px;
        resize: vertical;
      }

      button {
        background: linear-gradient(135deg, var(--primary), var(--accent));
        border: none;
        cursor: pointer;
        font-weight: bold;
      }

      .room-search, .profile-input {
        width: 100%;
        margin-top: 10px;
      }

      .room-item {
        background: #1e293b;
        padding: 12px;
        border-radius: 10px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: 0.2s ease;
      }

      .room-item:hover {
        background: #243244;
      }

      .room-item.active {
        outline: 2px solid var(--primary);
      }

      .status {
        margin-top: 14px;
        color: #86efac;
        font-size: 0.9rem;
      }

      .profile-box {
        margin-top: 20px;
        background: rgba(30,41,59,0.7);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 12px;
      }

      .profile-header {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 12px;
      }

      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--primary);
        font-weight: bold;
      }

      .message-item {
        background: #1f2937;
        border: 1px solid rgba(148,163,184,0.14);
        padding: 12px 14px;
        border-radius: 12px;
        margin-bottom: 12px;
      }

      .message-meta {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 8px;
      }

      .message-text {
        white-space: pre-wrap;
        line-height: 1.6;
      }

      .message-actions {
        margin-top: 8px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .mini-btn {
        padding: 6px 10px;
        font-size: 12px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.15);
        color: var(--text);
      }

      .reaction-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 10px;
      }

      .reaction-pill {
        border-radius: 999px;
        padding: 4px 8px;
        background: rgba(148,163,184,0.1);
        color: var(--text);
        font-size: 12px;
      }

      .empty {
        color: var(--muted);
        text-align: center;
        padding: 30px 10px;
      }

      .toast {
        position: fixed;
        left: 20px;
        bottom: 20px;
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
        display: none;
        color: var(--text);
      }
    </style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <h3>الغرف</h3>
        <input id="roomSearch" class="room-search" placeholder="بحث عن غرفة..." />
        <div id="roomsList"></div>

        <div style="margin-top: 18px;">
          <input id="roomNameInput" placeholder="اسم غرفة جديدة" style="width:100%; box-sizing:border-box;" />
          <button id="createRoomBtn" style="width:100%; margin-top: 10px;">إنشاء غرفة</button>
        </div>

        <div class="profile-box">
          <div class="profile-header">
            <div class="avatar" id="profileAvatar">U</div>
            <div>
              <strong id="profileName">المستخدم</strong>
              <div style="color: var(--muted); font-size: 12px;" id="profileRole">user</div>
            </div>
          </div>

          <textarea id="bioInput" class="profile-input" placeholder="نبذة ق��يرة..."></textarea>
          <input id="avatarInput" class="profile-input" placeholder="رابط الصورة الشخصية" />
          <input id="colorInput" class="profile-input" type="color" value="#60a5fa" />
          <button id="saveProfileBtn" style="width:100%; margin-top:10px;">حفظ الملف الشخصي</button>
        </div>

        <div id="status" class="status">غير متصل</div>
      </aside>

      <main class="main">
        <div class="header">
          <div class="title" id="roomTitle">الرئيسية</div>
          <button id="logoutBtn" class="mini-btn" style="background: rgba(239,68,68,0.15);">تسجيل الخروج</button>
        </div>

        <div class="messages" id="messages"></div>

        <div class="input-wrap">
          <textarea id="messageInput" placeholder="اكتب رسالتك..." style="flex:1;"></textarea>
          <button id="sendBtn" style="min-width: 120px;">إرسال</button>
        </div>
      </main>
    </div>

    <div id="toast" class="toast"></div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      const token = localStorage.getItem('sqourToken');
      const socket = io();
      const roomsList = document.getElementById('roomsList');
      const messagesEl = document.getElementById('messages');
      const roomTitle = document.getElementById('roomTitle');
      const statusEl = document.getElementById('status');
      const toast = document.getElementById('toast');

      const state = {
        activeRoom: 'الرئيسية',
        rooms: [],
        profile: null,
        currentUser: JSON.parse(localStorage.getItem('sqourUser') || '{}')
      };

      if (!token) {
        window.location.href = '/';
      }

      function showToast(message) {
        toast.textContent = message;
        toast.style.display = 'block';
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => {
          toast.style.display = 'none';
        }, 2200);
      }

      function renderRooms() {
        const q = document.getElementById('roomSearch').value.trim().toLowerCase();
        const filtered = state.rooms.filter((room) => {
          if (!q) return true;
          return room.name.toLowerCase().includes(q) || (room.description || '').toLowerCase().includes(q);
        });

        roomsList.innerHTML = '';

        if (!filtered.length) {
          roomsList.innerHTML = '<div class="empty">لا توجد غرف</div>';
          return;
        }

        filtered.forEach((room) => {
          const btn = document.createElement('div');
          btn.className = 'room-item' + (room.name === state.activeRoom ? ' active' : '');
          btn.textContent = room.name;
          btn.onclick = async () => {
            state.activeRoom = room.name;
            roomTitle.textContent = room.name;
            renderRooms();
            await loadRoomMessages(room.name);
            socket.emit('join-room', room.name);
          };
          roomsList.appendChild(btn);
        });
      }

      async function loadRooms() {
        const res = await fetch('/api/rooms', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.ok) return;
        state.rooms = data.rooms || [];
        renderRooms();
      }

      async function loadProfile() {
        const res = await fetch('/api/users/me/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.ok || !data.profile) return;

        state.profile = data.profile;
        document.getElementById('bioInput').value = data.profile.bio || '';
        document.getElementById('avatarInput').value = data.profile.avatar || '';
        document.getElementById('colorInput').value = data.profile.themeColor || '#60a5fa';
        document.getElementById('profileAvatar').textContent = (state.currentUser.username || 'U').charAt(0).toUpperCase();
        document.getElementById('profileName').textContent = state.currentUser.displayName || state.currentUser.username || 'المستخدم';
        document.getElementById('profileRole').textContent = state.currentUser.role || 'user';
      }

      async function saveProfile() {
        const payload = {
          bio: document.getElementById('bioInput').value,
          avatar: document.getElementById('avatarInput').value,
          themeColor: document.getElementById('colorInput').value
        };

        const res = await fetch('/api/users/me/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!data.ok) {
          showToast(data.message || 'فشل حفظ الملف الشخصي');
          return;
        }

        showToast('تم حفظ الملف الشخصي');
        state.profile = data.profile;
      }

      async function createRoom() {
        const name = document.getElementById('roomNameInput').value.trim();
        if (!name) return;

        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ name })
        });

        const data = await res.json();
        if (data.ok) {
          document.getElementById('roomNameInput').value = '';
          await loadRooms();
          state.activeRoom = data.room.name;
          roomTitle.textContent = data.room.name;
          await loadRoomMessages(data.room.name);
        }
      }

      function reactionSummary(reactions = []) {
        if (!Array.isArray(reactions) || !reactions.length) return '';
        const counts = {};
        reactions.forEach((r) => {
          counts[r.emoji] = (counts[r.emoji] || 0) + 1;
        });

        return Object.entries(counts)
          .map(([emoji, count]) => `<span class="reaction-pill">${emoji} ${count}</span>`)
          .join('');
      }

      function renderMessages(messages) {
        messagesEl.innerHTML = '';

        if (!messages.length) {
          messagesEl.innerHTML = '<div class="empty">لا توجد رسائل في هذه الغرفة</div>';
          return;
        }

        messages.forEach((msg) => {
          const item = document.createElement('div');
          item.className = 'message-item';

          const userName = msg.username || 'user';
          const isOwner = msg.userId === state.currentUser.id || state.currentUser.role === 'admin' || state.currentUser.role === 'moderator';

          item.innerHTML = `
            <div class="message-meta">
              <span>${userName}</span>
              <span>${new Date(msg.createdAt).toLocaleString()}</span>
            </div>
            <div class="message-text">${(msg.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            <div class="reaction-row">${reactionSummary(msg.reactions || [])}</div>
            <div class="message-actions">
              ${['👍', '❤️', '🔥', '😂'].map((emoji) => `<button class="mini-btn" data-react="${emoji}" data-message-id="${msg.id}">${emoji}</button>`).join('')}
              ${isOwner ? `<button class="mini-btn" data-edit="${msg.id}">تعديل</button>` : ''}
              ${isOwner ? `<button class="mini-btn" data-delete="${msg.id}">حذف</button>` : ''}
            </div>
          `;

          item.querySelectorAll('[data-react]').forEach((button) => {
            button.onclick = async () => {
              await fetch(`/api/rooms/${encodeURIComponent(state.activeRoom)}/messages/${msg.id}/react`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ emoji: button.dataset.react })
              });
              await loadRoomMessages(state.activeRoom);
            };
          });

          const editBtn = item.querySelector('[data-edit]');
          if (editBtn) {
            editBtn.onclick = async () => {
              const text = prompt('تعديل الرسالة', msg.text || '');
              if (text === null) return;
              const res = await fetch(`/api/rooms/${encodeURIComponent(state.activeRoom)}/messages/${msg.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text })
              });
              const data = await res.json();
              if (!data.ok) showToast(data.message || 'فشل تعديل الرسالة');
              await loadRoomMessages(state.activeRoom);
            };
          }

          const deleteBtn = item.querySelector('[data-delete]');
          if (deleteBtn) {
            deleteBtn.onclick = async () => {
              if (!confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;
              const res = await fetch(`/api/rooms/${encodeURIComponent(state.activeRoom)}/messages/${msg.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (!data.ok) showToast(data.message || 'فشل حذف الرسالة');
              await loadRoomMessages(state.activeRoom);
            };
          }

          messagesEl.appendChild(item);
        });
      }

      async function loadRoomMessages(roomName) {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomName)}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.ok) return;
        renderMessages(data.messages || []);
      }

      async function sendMessage() {
        const text = document.getElementById('messageInput').value.trim();
        if (!text) return;

        const res = await fetch(`/api/rooms/${encodeURIComponent(state.activeRoom)}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ text })
        });

        const data = await res.json();
        if (!data.ok) {
          showToast(data.message || 'فشل إرسال الرسالة');
          return;
        }

        document.getElementById('messageInput').value = '';
        await loadRoomMessages(state.activeRoom);
      }

      socket.on('connect', () => {
        statusEl.textContent = 'متصل';
        socket.emit('auth', { token });
      });

      socket.on('auth_ok', ({ roomId }) => {
        state.activeRoom = roomId || 'الرئيسية';
        roomTitle.textContent = state.activeRoom;
        socket.emit('join-room', state.activeRoom);
      });

      socket.on('presence', (payload) => {
        if (payload.type === 'online') {
          statusEl.textContent = `متصل • ${payload.user.username}`;
        }
      });

      socket.on('new-message', async (msg) => {
        if (msg && msg.roomId === state.activeRoom) {
          await loadRoomMessages(state.activeRoom);
        }
      });

      socket.on('message-edited', async ({ roomId, message }) => {
        if (roomId === state.activeRoom) {
          await loadRoomMessages(state.activeRoom);
        }
      });

      socket.on('message-deleted', async ({ roomId }) => {
        if (roomId === state.activeRoom) {
          await loadRoomMessages(state.activeRoom);
        }
      });

      socket.on('message-reacted', async ({ roomId }) => {
        if (roomId === state.activeRoom) {
          await loadRoomMessages(state.activeRoom);
        }
      });

      document.getElementById('roomSearch').addEventListener('input', renderRooms);
      document.getElementById('createRoomBtn').onclick = createRoom;
      document.getElementById('sendBtn').onclick = sendMessage;
      document.getElementById('saveProfileBtn').onclick = saveProfile;
      document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('sqourToken');
        localStorage.removeItem('sqourUser');
        window.location.href = '/';
      };

      document.getElementById('messageInput').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });

      (async function init() {
        await loadRooms();
        await loadProfile();
        if (state.rooms.length) {
          state.activeRoom = state.rooms[0].name;
          roomTitle.textContent = state.activeRoom;
          await loadRoomMessages(state.activeRoom);
        }
      })();
    </script>
  </body>
</html>
