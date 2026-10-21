const path = require('path');

const rootDir = path.resolve(__dirname, '..');

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  HOST: process.env.HOST || '0.0.0.0',
  DEFAULT_ROOM: process.env.DEFAULT_ROOM || 'الرئيسية',
  JWT_SECRET: process.env.JWT_SECRET || 'sqour-arb-super-secret-key',
  ROOT_DIR: rootDir,
  DATA_DIR: path.join(rootDir, 'data'),
  STATIC_DIRS: [
    path.join(rootDir, 'sqour-arb0'),
    path.join(rootDir, 'sqour-arb1'),
    path.join(rootDir, 'sqour-arb2')
  ]
};
