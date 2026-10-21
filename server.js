const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const { PORT, HOST, STATIC_DIRS, ENTRY_POINTS, NODE_ENV } = require('./src/config');
const { registerSocket } = require('./src/socketHandlers');
const apiRoutes = require('./src/routes');
const { ensureSeedData } = require('./src/db');

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

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  if (ENTRY_POINTS.home && fs.existsSync(ENTRY_POINTS.home)) {
    return res.sendFile(ENTRY_POINTS.home);
  }
  res.json({ ok: true, message: 'sqour-arb server is running' });
});

app.get('/chat', (req, res) => {
  if (ENTRY_POINTS.chat && fs.existsSync(ENTRY_POINTS.chat)) {
    return res.sendFile(ENTRY_POINTS.chat);
  }
  res.json({ ok: true, message: 'Chat endpoint' });
});

app.get('/admin', (req, res) => {
  if (ENTRY_POINTS.admin && fs.existsSync(ENTRY_POINTS.admin)) {
    return res.sendFile(ENTRY_POINTS.admin);
  }
  res.json({ ok: true, message: 'Admin endpoint' });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'sqour-arb server is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, message: 'Internal server error' });
});

ensureSeedData();
io.on('connection', (socket) => registerSocket(io, socket));

server.listen(PORT, HOST, () => {
  console.log(`🚀 السيرفر يعمل على http://${HOST}:${PORT}`);
  console.log('📡 Socket.IO جاهز للتواصل');
});

module.exports = { app, server, io };
