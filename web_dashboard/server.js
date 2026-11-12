const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const BASE_PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_TRIES = 10;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// FIX: the old server returned ANY file in this folder, including server.js, supabase_config.json,
// .py scripts, .sql files, .env and .git contents. Only the dashboard's own asset types are served,
// and hidden files / config files are always blocked.
const BLOCKED_NAMES = new Set(['server.js', 'supabase_config.json', 'package.json', 'package-lock.json']);

function isBlocked(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (rel.split(path.sep).some((part) => part.startsWith('.'))) return true; // .git, .env ...
  if (BLOCKED_NAMES.has(path.basename(filePath))) return true;
  if (rel.split(path.sep)[0] === 'node_modules') return true;
  return !MIME_TYPES[path.extname(filePath).toLowerCase()];
}

const server = http.createServer((req, res) => {
  let reqPath;
  try {
    // FIX: decode %20 etc. so files with spaces load; malformed encodings get a 400
    reqPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, reqPath));

  // FIX: compare with a trailing separator, otherwise a sibling folder such as
  // "<root>-backup" would also pass the startsWith() check
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  if (isBlocked(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File Not Found');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext],
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
});

function getLanAddresses() {
  const virtualPattern = /vmware|vmnet|virtualbox|vbox|vethernet|wsl|docker|hyper-v|tun|tap|vpn|loopback|tailscale|zerotier/i;
  const preferred = [];
  const fallback = [];
  for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const entry = { name, address: iface.address };
        if (virtualPattern.test(name)) fallback.push(entry);
        else preferred.push(entry);
      }
    }
  }
  return preferred.length > 0 ? preferred : fallback;
}

function openBrowser(url) {
  // FIX: "start" only exists on Windows
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => {}); // ignore errors (e.g. no desktop on a server)
}

let currentPort = BASE_PORT;

server.on('listening', () => {
  const lans = getLanAddresses();
  console.log(`\n======================================================`);
  console.log(`🚀 SDAS Live Web Dashboard Running!`);
  console.log(`📡 Local URL:    http://localhost:${currentPort}`);
  // FIX: the old "Network URL" printed 127.0.0.1 or virtual TUN/VMware adapters first
  for (const lan of lans) {
    console.log(`🌐 Network URL:  http://${lan.address}:${currentPort}  (${lan.name} - same Wi-Fi / hotspot)`);
  }
  console.log(`🛡️ Supabase Node: SDAS-NODE-01`);
  console.log(`======================================================\n`);
  if (!process.env.NO_BROWSER) openBrowser(`http://localhost:${currentPort}`);
});

server.on('error', (err) => {
  // FIX: the old handler always "fell back" to 3001; if 3001 was also busy it looped forever
  if (err.code === 'EADDRINUSE' && currentPort < BASE_PORT + MAX_PORT_TRIES - 1) {
    console.log(`⚠️ Port ${currentPort} is in use, trying ${currentPort + 1}...`);
    currentPort += 1;
    server.listen(currentPort, '0.0.0.0');
  } else {
    console.error('Server error:', err.message);
    process.exit(1);
  }
});

server.listen(currentPort, '0.0.0.0');
