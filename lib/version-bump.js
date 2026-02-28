'use strict';

const fs = require('fs');
const path = require('path');
const PKG_PATH = path.join(__dirname, '..', 'package.json');

let bumpTimer = null;
const DEBOUNCE_MS = 1500;

function bumpPatch() {
    if (bumpTimer) return;
    bumpTimer = setTimeout(() => {
        bumpTimer = null;
        try {
            const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
            const parts = (pkg.version || '1.0.0').split('.').map(Number);
            parts[2] = (parts[2] || 0) + 1;
            pkg.version = parts.join('.');
            fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
            console.log(`  🔖  Version bumped → ${pkg.version}`);
        } catch (e) { console.warn('  ⚠️  Version bump failed:', e.message); }
    }, DEBOUNCE_MS);
}

function startVersionWatcher(chokidar) {
    const watcher = chokidar.watch([
        path.join(__dirname, '..', 'public'),
        path.join(__dirname, '..', 'routes'),
        path.join(__dirname, '..', 'lib'),
        path.join(__dirname, '..', 'middleware'),
        path.join(__dirname, '..', 'server.js'),
    ], {
        ignored: [/node_modules/, /\.trash/, /tiptap-bundle\.js/, /package\.json/],
        persistent: true,
        ignoreInitial: true,
    });
    watcher.on('change', (filePath) => {
        if (/\.(js|html|css|json)$/.test(filePath) && !/package\.json/.test(filePath)) bumpPatch();
    });
    return watcher;
}

module.exports = { startVersionWatcher };
