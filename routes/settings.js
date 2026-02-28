'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getConfig, updateConfig } = require('../lib/config');

const router = express.Router();

router.get('/', (req, res) => {
    const pkgPath = require.resolve('../package.json');
    delete require.cache[pkgPath];
    const version = require(pkgPath).version;
    const config = getConfig();
    res.json({
        version,
        journalPath: config.journalPath || path.join(os.homedir(), 'Journal'),
        sessionDurationHours: config.sessionDurationHours || 24,
        defaultSort: config.defaultSort || 'modified',
        fontSize: config.fontSize || 16,
    });
});

router.post('/', (req, res) => {
    const { journalPath, sessionDurationHours, defaultSort, fontSize } = req.body;
    const updates = {};
    if (journalPath !== undefined) {
        try {
            if (!fs.existsSync(journalPath)) fs.mkdirSync(journalPath, { recursive: true });
            updates.journalPath = journalPath;
        } catch (err) { return res.status(400).json({ error: `Cannot use path: ${err.message}` }); }
    }
    if (sessionDurationHours !== undefined) updates.sessionDurationHours = Number(sessionDurationHours);
    if (defaultSort !== undefined) updates.defaultSort = defaultSort;
    if (fontSize !== undefined) updates.fontSize = Number(fontSize);
    updateConfig(updates);
    res.json({ ok: true });
});

router.post('/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const config = getConfig();
    if (!config.passwordHash) return res.status(400).json({ error: 'No password set.' });
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters.' });
    const match = await bcrypt.compare(currentPassword, config.passwordHash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(newPassword, 12);
    updateConfig({ passwordHash: hash });
    res.json({ ok: true });
});

module.exports = router;
