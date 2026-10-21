const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const { PORT, HOST, STATIC_DIRS, ENTRY_POINTS } = require('./src/config');
const { registerSocket } = require('./src/socketHandlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

for (const dir of STATIC_DIRS) {
  app.use(express.static(dir, { index: false, redirect: false }));
}

app.get('/', (req, res) => {
  res.sendFile(ENTRY_POINTS.home);
});

app.get('/chat', (req, res) => {
  res.sendFile(ENTRY_POINTS.chat);
});

app.get('/admin', (req, res) => {
  res.sendFile(ENTRY_POINTS.admin);
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'sqour-arb server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Not found'
  });
});

io.on('connection', (socket) => registerSocket(io, socket));

server.listen(PORT, HOST, () => {
  console.log(`🚀 السيرفر يعمل على http://${HOST}:${PORT}`);
  console.log('📡 Socket.IO جاهز للتواصل');
});

module.exports = { app, server, io };
