'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const { v4: uuidv4 } = require('uuid');
const { getConfig } = require('../lib/config');

const router = express.Router();

function getJournalPath() {
    const config = getConfig();
    const jp = config.journalPath || path.join(os.homedir(), 'Journal');
    if (!fs.existsSync(jp)) fs.mkdirSync(jp, { recursive: true });
    return jp;
}

function parseEntry(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);
    const metaMatch = raw.match(/^<!--\n([\s\S]*?)\n-->/);
    let meta = {};
    if (metaMatch) { try { meta = yaml.load(metaMatch[1]) || {}; } catch { } }
    const stat = fs.statSync(filePath);
    const created = meta.created || stat.birthtime.toISOString();
    const modified = meta.modified || stat.mtime.toISOString();
    const title = meta.title || filename.replace(/\.html$/, '').replace(/_/g, ' ');
    const pinned = meta.pinned || false;
    const tags = meta.tags || [];
    const revision = meta.revision || 0;
    const bodyStart = metaMatch ? raw.indexOf('-->\n') + 4 : 0;
    const bodyHtml = raw.slice(bodyStart);
    const preview = bodyHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
    return { filename, title, created, modified, pinned, tags, revision, preview };
}

function buildFrontmatter(meta) { return `<!--\n${yaml.dump(meta).trim()}\n-->`; }
function slugify(str) { return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60); }
function generateFilename(title, date) { return `${date.toISOString().slice(0, 10)}_${slugify(title) || 'untitled'}.html`; }
function writeEntry(filePath, meta, bodyHtml) { fs.writeFileSync(filePath, `${buildFrontmatter(meta)}\n\n${bodyHtml}`, 'utf8'); }

router.get('/', (req, res) => {
    const jp = getJournalPath();
    try {
        const files = fs.readdirSync(jp).filter(f => f.endsWith('.html'));
        const entries = files.map(filename => {
            try { return parseEntry(path.join(jp, filename)); }
            catch { return { filename, title: filename, created: '', modified: '', preview: '', pinned: false, tags: [] }; }
        });
        res.json(entries);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:filename', (req, res) => {
    const jp = getJournalPath();
    const filePath = path.join(jp, path.basename(req.params.filename));
    if (!filePath.startsWith(jp)) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const meta = parseEntry(filePath);
        const bodyStart = raw.indexOf('-->\n');
        const bodyHtml = bodyStart !== -1 ? raw.slice(bodyStart + 4).trim() : raw.trim();
        const stat = fs.statSync(filePath);
        res.json({ ...meta, html: bodyHtml, diskModified: stat.mtime.toISOString() });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
    const jp = getJournalPath();
    const { title = 'Untitled', html = '<p></p>' } = req.body;
    const now = new Date();
    let filename = generateFilename(title, now);
    let filePath = path.join(jp, filename);
    let counter = 1;
    while (fs.existsSync(filePath)) { filename = generateFilename(`${title}-${counter}`, now); filePath = path.join(jp, filename); counter++; }
    const meta = { title, created: now.toISOString(), modified: now.toISOString(), pinned: false, tags: [], revision: 1 };
    try { writeEntry(filePath, meta, html); res.status(201).json({ filename, ...meta }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:filename', (req, res) => {
    const jp = getJournalPath();
    const filePath = path.join(jp, path.basename(req.params.filename));
    if (!filePath.startsWith(jp)) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    const { html, diskModified } = req.body;
    try {
        if (diskModified) {
            const diskMtime = fs.statSync(filePath).mtime.toISOString();
            if (diskMtime !== diskModified) return res.status(409).json({ error: 'conflict', diskModified: diskMtime });
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        const metaMatch = raw.match(/^<!--\n([\s\S]*?)\n-->/);
        let meta = {};
        if (metaMatch) { try { meta = yaml.load(metaMatch[1]) || {}; } catch { } }
        meta.modified = new Date().toISOString();
        meta.revision = (meta.revision || 0) + 1;
        writeEntry(filePath, meta, html);
        const stat = fs.statSync(filePath);
        res.json({ ok: true, modified: meta.modified, diskModified: stat.mtime.toISOString(), revision: meta.revision });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:filename', (req, res) => {
    const jp = getJournalPath();
    const oldPath = path.join(jp, path.basename(req.params.filename));
    if (!oldPath.startsWith(jp)) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'Not found' });
    const { title, pinned } = req.body;
    try {
        const raw = fs.readFileSync(oldPath, 'utf8');
        const metaMatch = raw.match(/^<!--\n([\s\S]*?)\n-->/);
        let meta = {};
        if (metaMatch) { try { meta = yaml.load(metaMatch[1]) || {}; } catch { } }
        if (title !== undefined) meta.title = title;
        if (pinned !== undefined) meta.pinned = pinned;
        meta.modified = new Date().toISOString();
        const bodyStart = raw.indexOf('-->\n');
        const bodyHtml = bodyStart !== -1 ? raw.slice(bodyStart + 4).trim() : raw.trim();
        let newFilename = req.params.filename;
        let newPath = oldPath;
        if (title !== undefined) {
            const createdDate = meta.created ? new Date(meta.created) : new Date();
            newFilename = generateFilename(title, createdDate);
            newPath = path.join(jp, newFilename);
            let counter = 1;
            while (fs.existsSync(newPath) && newPath !== oldPath) { newFilename = generateFilename(`${title}-${counter}`, createdDate); newPath = path.join(jp, newFilename); counter++; }
        }
        writeEntry(newPath, meta, bodyHtml);
        if (newPath !== oldPath) fs.unlinkSync(oldPath);
        res.json({ ok: true, filename: newFilename, ...meta });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:filename', (req, res) => {
    const jp = getJournalPath();
    const filePath = path.join(jp, path.basename(req.params.filename));
    if (!filePath.startsWith(jp)) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    try {
        const trashDir = path.join(jp, '.trash');
        if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir);
        fs.renameSync(filePath, path.join(trashDir, path.basename(req.params.filename)));
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
