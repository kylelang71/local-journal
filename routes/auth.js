'use strict';

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { getConfig, updateConfig } = require('../lib/config');

const router = express.Router();

router.get('/api/auth/status', (req, res) => {
    const config = getConfig();
    res.json({ firstRun: !config.passwordHash, authenticated: !!(req.session && req.session.authenticated) });
});

router.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) return res.redirect('/');
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

router.post('/api/setup', async (req, res) => {
    const config = getConfig();
    if (config.passwordHash) return res.status(400).json({ error: 'Password already set.' });
    const { password } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    const hash = await bcrypt.hash(password, 12);
    updateConfig({ passwordHash: hash });
    req.session.authenticated = true;
    res.json({ ok: true });
});

router.post('/api/login', async (req, res) => {
    const config = getConfig();
    if (!config.passwordHash) return res.status(400).json({ error: 'No password set.' });
    const { password } = req.body;
    const match = await bcrypt.compare(password, config.passwordHash);
    if (!match) return res.status(401).json({ error: 'Incorrect password.' });
    req.session.authenticated = true;
    req.session.cookie.maxAge = (config.sessionDurationHours || 24) * 60 * 60 * 1000;
    res.json({ ok: true });
});

router.post('/api/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

module.exports = router;
