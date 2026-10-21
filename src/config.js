const path = require('path');

const rootDir = path.resolve(__dirname, '..');

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  HOST: process.env.HOST || '0.0.0.0',
  DEFAULT_ROOM: process.env.DEFAULT_ROOM || 'الرئيسية',
  ROOT_DIR: rootDir,
  STATIC_DIRS: [
    path.join(rootDir, 'sqour-arb0'),
    path.join(rootDir, 'sqour-arb1'),
    path.join(rootDir, 'sqour-arb2')
  ],
  ENTRY_POINTS: {
    home: path.join(rootDir, 'sqour-arb0', 'index.html'),
    chat: path.join(rootDir, 'sqour-arb2', 'index.html'),
    admin: path.join(rootDir, 'sqour-arb1', 'index.html')
  }
};
