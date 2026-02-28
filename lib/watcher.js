'use strict';

const chokidar = require('chokidar');
const path = require('path');
const os = require('os');
const { getConfig } = require('./config');

let watcher = null;

function startWatcher(onChange) {
    const config = getConfig();
    const journalPath = config.journalPath || path.join(os.homedir(), 'Journal');
    if (watcher) watcher.close();
    watcher = chokidar.watch(journalPath, {
        ignored: [/(^|[/\\])\../, /\.trash/],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });
    watcher
        .on('add', f => { if (f.endsWith('.html')) onChange('add', f); })
        .on('change', f => { if (f.endsWith('.html')) onChange('change', f); })
        .on('unlink', f => { if (f.endsWith('.html')) onChange('unlink', f); });
    return watcher;
}

function restartWatcher(onChange) { return startWatcher(onChange); }
module.exports = { startWatcher, restartWatcher };
