'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const CONFIG_DIR = path.join(os.homedir(), '.localjournal');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
    journalPath: path.join(os.homedir(), 'Journal'),
    sessionDurationHours: 24,
    defaultSort: 'modified',
    fontSize: 16,
};

function ensureConfig() {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    if (!fs.existsSync(CONFIG_FILE)) {
        const initial = { ...DEFAULTS, sessionSecret: crypto.randomBytes(64).toString('hex'), passwordHash: null };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(initial, null, 2), { mode: 0o600 });
    } else {
        const cfg = readConfig();
        if (!cfg.sessionSecret) { cfg.sessionSecret = crypto.randomBytes(64).toString('hex'); writeConfig(cfg); }
    }
}

function readConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch { return { ...DEFAULTS, sessionSecret: crypto.randomBytes(64).toString('hex'), passwordHash: null }; }
}

function writeConfig(data) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), { mode: 0o600 }); }
function getConfig() { return readConfig(); }
function updateConfig(updates) { const cfg = readConfig(); const merged = { ...cfg, ...updates }; writeConfig(merged); return merged; }

module.exports = { ensureConfig, getConfig, updateConfig };
