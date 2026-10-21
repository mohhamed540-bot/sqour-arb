const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

const { PORT, HOST, STATIC_DIRS, NODE_ENV } = require('./src/config');
const { initDatabase } = require('./src/db');
const { createApiRouter } = require('./src/routes');
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

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many requests, please try again later.' }
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

for (const dir of STATIC_DIRS) {
  app.use(express.static(dir, { index: false, redirect: false }));
}

const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.use('/api', createApiRouter());

app.get('/', (req, res) => {
  const home = path.join(publicDir, 'index.html');
  if (fs.existsSync(home)) return res.sendFile(home);
  res.send('sqour-arb ready');
});

app.get('/chat', (req, res) => {
  const chat = path.join(publicDir, 'chat.html');
  if (fs.existsSync(chat)) return res.sendFile(chat);
  res.send('chat ready');
});

app.get('/admin', (req, res) => {
  const admin = path.join(publicDir, 'admin.html');
  if (fs.existsSync(admin)) return res.sendFile(admin);
  res.send('admin ready');
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'sqour-arb server is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV || 'development'
  });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, message: 'Internal server error' });
});

initDatabase();
io.on('connection', (socket) => registerSocket(io, socket));

server.listen(PORT, HOST, () => {
  console.log(`🚀 السيرفر يعمل على http://${HOST}:${PORT}`);
  console.log('📡 Socket.IO جاهز للتواصل');
});

module.exports = { app, server, io };
