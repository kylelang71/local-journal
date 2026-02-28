'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
require('dotenv').config();

const authRouter = require('./routes/auth');
const entriesRouter = require('./routes/entries');
const settingsRouter = require('./routes/settings');
const { requireAuth } = require('./middleware/requireAuth');
const { getConfig, ensureConfig } = require('./lib/config');
const { startWatcher } = require('./lib/watcher');
const { startVersionWatcher } = require('./lib/version-bump');
const chokidar = require('chokidar');

const app = express();
const PORT = process.env.PORT || 3000;

ensureConfig();
const config = getConfig();

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: (config.sessionDurationHours || 24) * 60 * 60 * 1000,
  },
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const journalPath = config.journalPath || path.join(os.homedir(), 'Journal');
if (!fs.existsSync(journalPath)) fs.mkdirSync(journalPath, { recursive: true });
app.use('/journal-assets', requireAuth, express.static(journalPath));

app.use('/', authRouter);
app.use('/api/entries', requireAuth, entriesRouter);
app.use('/api/settings', requireAuth, settingsRouter);

app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/settings', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'settings.html')));

const sseClients = [];
app.get('/api/watch', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const client = { res };
  sseClients.push(client);
  req.on('close', () => {
    const idx = sseClients.indexOf(client);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

startWatcher((event, filePath) => {
  const data = JSON.stringify({ event, file: path.basename(filePath) });
  sseClients.forEach(c => c.res.write(`data: ${data}\n\n`));
});

startVersionWatcher(chokidar);

const multer = require('multer');
const assetsDir = path.join(journalPath, '_assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, assetsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.heic'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/journal-assets/_assets/${req.file.filename}` });
});

app.listen(PORT, () => console.log(`\n  📔 Local Journal running at http://localhost:${PORT}\n`));
