const fs = require('fs');
const path = require('path');

module.exports = {
  appName: 'sqour-arb',
  ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  },
  rootDir: path.resolve(__dirname, '..'),
  publicDir: path.join(path.resolve(__dirname, '..'), 'public')
};
