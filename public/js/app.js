/**
 * app.js — Main application controller.
 * Manages: entry list, sidebar, selection, auto-save,
 * conflict detection, SSE file watching, context menu.
 */

window.JournalApp = (() => {
    'use strict';

    let entries = [];
    let currentFilename = null;
    let currentDiskModified = null;
    let saveTimer = null;
    let searchQuery = '';
    let sortOrder = 'modified';
    let isSaving = false;
    let editorReady = false;
    let appVersion = 'v1.0.0';
    let FontSize = 16;

    const AUTOSAVE_DELAY = 2000;
    const CRASH_KEY = 'lj_crash_draft';

    function showToast(msg, isError = false) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast' + (isError ? ' is-error' : '');
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    function setVersionDisplay() {
        const el = document.getElementById('version-display');
        if (el) el.textContent = appVersion;
    }

    function setSaveState(state, text) {
        const icon = document.getElementById('save-icon');
        const label = document.getElementById('save-label');
        if (icon) {
            icon.className = 'status-bar__save-icon' +
                (state === 'saved' ? ' is-saved' : '') +
                (state === 'saving' ? ' is-saving' : '');
        }
        if (label) label.textContent = text;
    }

    function updateWordCount() {
        const text = window.JournalEditor?.getHTML()
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || '';
        const words = text ? text.split(/\s+/).length : 0;
        const chars = text.replace(/\s/g, '').length;
        const el = document.getElementById('word-count');
        if (el) el.textContent = `${words.toLocaleString()} words · ${chars.toLocaleString()} chars`;
    }

    function getFilteredEntries() {
        let list = [...entries];
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(e => e.title.toLowerCase().includes(q) || (e.preview || '').toLowerCase().includes(q));
        }
        const pinned = list.filter(e => e.pinned);
        const unpinned = list.filter(e => !e.pinned);
        const sortFn = (a, b) => {
            switch (sortOrder) {
                case 'modified': return new Date(b.modified) - new Date(a.modified);
                case 'created': return new Date(b.created) - new Date(a.created);
                case 'title-asc': return a.title.localeCompare(b.title);
                case 'title-desc': return b.title.localeCompare(a.title);
                default: return 0;
            }
        };
        return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)];
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            const now = new Date();
            const diff = now - d;
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
            if (d.toDateString() === now.toDateString()) return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
            if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
            return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
        } catch { return iso.slice(0, 10); }
    }

    function renderSidebar() {
        const list = document.getElementById('entry-list');
        if (!list) return;
        const filtered = getFilteredEntries();
        if (filtered.length === 0) {
            list.innerHTML = `<p class="sidebar__empty">${searchQuery ? 'No results.' : 'No entries yet.'}</p>`;
            return;
        }
        list.innerHTML = '';
        filtered.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'entry-item' + (entry.filename === currentFilename ? ' is-selected' : '') + (entry.pinned ? ' is-pinned' : '');
            item.dataset.filename = entry.filename;
            item.setAttribute('role', 'listitem');
            item.setAttribute('tabindex', '0');
            const titleEl = document.createElement('div');
            titleEl.className = 'entry-item__title';
            titleEl.textContent = entry.title;
            titleEl.title = 'Double-click to rename';
            const metaEl = document.createElement('div');
            metaEl.className = 'entry-item__meta';
            metaEl.textContent = formatDate(entry.modified);
            const previewEl = document.createElement('div');
            previewEl.className = 'entry-item__preview';
            previewEl.textContent = entry.preview || '';
            item.appendChild(titleEl);
            item.appendChild(metaEl);
            item.appendChild(previewEl);
            item.addEventListener('click', (e) => { if (e.target.tagName === 'INPUT') return; openEntry(entry.filename); });
            item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openEntry(entry.filename); });
            item.addEventListener('contextmenu', (e) => showContextMenu(e, entry));
            titleEl.addEventListener('dblclick', (e) => { e.stopPropagation(); startInlineRename(titleEl, entry); });
            list.appendChild(item);
        });
    }

    function startInlineRename(titleEl, entry) {
        if (titleEl.querySelector('input')) return;
        const originalTitle = entry.title;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalTitle;
        input.className = 'entry-rename-input';
        input.setAttribute('aria-label', 'Rename entry');
        titleEl.textContent = '';
        titleEl.appendChild(input);
        input.focus();
        input.select();
        let committed = false;
        async function commit() {
            if (committed) return;
            committed = true;
            const newTitle = input.value.trim();
            titleEl.textContent = newTitle || originalTitle;
            if (newTitle && newTitle !== originalTitle) { await renameEntry(entry.filename, newTitle); }
            else { titleEl.textContent = originalTitle; }
        }
        function cancel() { if (committed) return; committed = true; titleEl.textContent = originalTitle; }
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.preventDefault(); cancel(); } e.stopPropagation(); });
        input.addEventListener('blur', commit);
        input.addEventListener('click', (e) => e.stopPropagation());
    }

    async function loadEntries() {
        try {
            const res = await fetch('/api/entries');
            if (res.status === 401) { window.location.href = '/login'; return; }
            entries = await res.json();
            renderSidebar();
        } catch { showToast('Could not load entries.', true); }
    }

    async function openEntry(filename) {
        if (currentFilename && currentFilename !== filename) await forceSave();
        try {
            const res = await fetch(`/api/entries/${encodeURIComponent(filename)}`);
            if (!res.ok) { showToast('Could not open entry.', true); return; }
            const data = await res.json();
            currentFilename = filename;
            currentDiskModified = data.diskModified || data.modified;
            showEditorCanvas();
            window.JournalEditor.setContent(data.html || '<p></p>');
            window.JournalEditor.focus();
            updateWordCount();
            setSaveState('saved', 'Auto-saved ✓');
            applyFontSize(FontSize);
            renderSidebar();
            persistCrashDraft();
        } catch { showToast('Could not open entry.', true); }
    }

    function showEditorCanvas() {
        document.getElementById('editor-placeholder')?.style.setProperty('display', 'none');
        const canvas = document.getElementById('editor-canvas');
        if (canvas) canvas.style.display = '';
    }

    function showPlaceholder() {
        document.getElementById('editor-placeholder')?.style.setProperty('display', '');
        const canvas = document.getElementById('editor-canvas');
        if (canvas) canvas.style.display = 'none';
    }

    function scheduleAutoSave() {
        if (saveTimer) clearTimeout(saveTimer);
        setSaveState('saving', 'Saving…');
        saveTimer = setTimeout(async () => { await doSave(); }, AUTOSAVE_DELAY);
    }

    async function doSave() {
        if (!currentFilename) return;
        isSaving = true;
        setSaveState('saving', 'Saving…');
        try {
            const html = window.JournalEditor.getHTML();
            const body = { html };
            if (currentDiskModified) body.diskModified = currentDiskModified;
            const res = await fetch(`/api/entries/${encodeURIComponent(currentFilename)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.status === 409) { const data = await res.json(); currentDiskModified = data.diskModified; showConflictDialog(); return; }
            if (res.ok) {
                const data = await res.json();
                currentDiskModified = data.diskModified;
                setSaveState('saved', 'Auto-saved ✓');
                const entry = entries.find(e => e.filename === currentFilename);
                if (entry) { entry.modified = data.modified; renderSidebar(); }
                persistCrashDraft();
            } else { setSaveState('', 'Error saving'); showToast('Could not save entry.', true); }
        } catch { setSaveState('', 'Error saving'); }
        finally { isSaving = false; }
    }

    async function forceSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } await doSave(); }

    function persistCrashDraft() {
        if (!currentFilename) return;
        localStorage.setItem(CRASH_KEY, JSON.stringify({ filename: currentFilename, html: window.JournalEditor.getHTML(), ts: Date.now() }));
    }

    function checkCrashRecovery() {
        const draft = localStorage.getItem(CRASH_KEY);
        if (!draft) return;
        try {
            const { filename, html, ts } = JSON.parse(draft);
            if (!filename || !html) return;
            if (Date.now() - ts > 86400000) { localStorage.removeItem(CRASH_KEY); return; }
            showToast('Restored unsaved changes from last session.');
            openEntry(filename).then(() => { window.JournalEditor.setContent(html); scheduleAutoSave(); });
        } catch { localStorage.removeItem(CRASH_KEY); }
    }

    async function newEntry() {
        if (currentFilename) await forceSave();
        try {
            const res = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Untitled', html: '<p></p>' }) });
            if (!res.ok) { showToast('Could not create entry.', true); return; }
            const data = await res.json();
            entries.unshift({ ...data, preview: '' });
            renderSidebar();
            await openEntry(data.filename);
            window.JournalEditor.focus();
        } catch { showToast('Could not create entry.', true); }
    }

    let ctxEntry = null;

    function showContextMenu(e, entry) {
        e.preventDefault();
        ctxEntry = entry;
        const menu = document.getElementById('context-menu');
        if (!menu) return;
        menu.style.top = e.clientY + 'px';
        menu.style.left = e.clientX + 'px';
        menu.classList.remove('is-hidden');
        const pinBtn = document.getElementById('ctx-pin');
        if (pinBtn) pinBtn.textContent = entry.pinned ? 'Unpin entry' : 'Pin entry';
    }

    function bindContextMenu() {
        document.getElementById('ctx-pin')?.addEventListener('click', async () => {
            if (!ctxEntry) return;
            document.getElementById('context-menu')?.classList.add('is-hidden');
            const res = await fetch(`/api/entries/${encodeURIComponent(ctxEntry.filename)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: !ctxEntry.pinned }) });
            if (res.ok) { ctxEntry.pinned = !ctxEntry.pinned; const e = entries.find(e => e.filename === ctxEntry.filename); if (e) e.pinned = ctxEntry.pinned; renderSidebar(); }
        });
        document.getElementById('ctx-rename')?.addEventListener('click', () => {
            if (!ctxEntry) return;
            document.getElementById('context-menu')?.classList.add('is-hidden');
            const name = prompt('Rename entry:', ctxEntry.title);
            if (!name || name === ctxEntry.title) return;
            renameEntry(ctxEntry.filename, name);
        });
        document.getElementById('ctx-delete')?.addEventListener('click', async () => {
            if (!ctxEntry) return;
            document.getElementById('context-menu')?.classList.add('is-hidden');
            if (!confirm(`Delete "${ctxEntry.title}"?`)) return;
            await deleteEntry(ctxEntry.filename);
        });
    }

    async function renameEntry(filename, title) {
        const res = await fetch(`/api/entries/${encodeURIComponent(filename)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
        if (res.ok) {
            const data = await res.json();
            const entry = entries.find(e => e.filename === filename);
            if (entry) { entry.filename = data.filename; entry.title = data.title; entry.modified = data.modified; if (currentFilename === filename) currentFilename = data.filename; }
            renderSidebar();
        }
    }

    async function deleteEntry(filename) {
        const res = await fetch(`/api/entries/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        if (res.ok) {
            entries = entries.filter(e => e.filename !== filename);
            if (currentFilename === filename) { currentFilename = null; currentDiskModified = null; window.JournalEditor.clearContent(); showPlaceholder(); setSaveState('', ''); localStorage.removeItem(CRASH_KEY); }
            renderSidebar();
        } else { showToast('Could not delete entry.', true); }
    }

    function showConflictDialog() { document.getElementById('conflict-overlay')?.classList.remove('is-hidden'); }

    function bindConflictDialog() {
        document.getElementById('conflict-reload')?.addEventListener('click', async () => { document.getElementById('conflict-overlay')?.classList.add('is-hidden'); if (currentFilename) await openEntry(currentFilename); });
        document.getElementById('conflict-overwrite')?.addEventListener('click', async () => { document.getElementById('conflict-overlay')?.classList.add('is-hidden'); currentDiskModified = null; await doSave(); });
        document.getElementById('conflict-new')?.addEventListener('click', async () => {
            document.getElementById('conflict-overlay')?.classList.add('is-hidden');
            const html = window.JournalEditor.getHTML();
            const res = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Conflict Copy — ' + (entries.find(e => e.filename === currentFilename)?.title || ''), html }) });
            if (res.ok) { const data = await res.json(); entries.unshift({ ...data, preview: html.replace(/<[^>]+>/g, '').slice(0, 140) }); renderSidebar(); await openEntry(data.filename); showToast('Saved as a new entry.'); }
        });
    }

    function connectSSE() {
        const es = new EventSource('/api/watch');
        es.onmessage = async (e) => {
            try {
                const { event, file } = JSON.parse(e.data);
                if (event === 'add' || event === 'change') { await loadEntries(); }
                else if (event === 'unlink') { entries = entries.filter(e => e.filename !== file); if (currentFilename === file) { currentFilename = null; window.JournalEditor.clearContent(); showPlaceholder(); } renderSidebar(); }
            } catch { }
        };
        es.onerror = () => { es.close(); setTimeout(connectSSE, 5000); };
    }

    function applyFontSize(size) { const el = document.querySelector('.ProseMirror'); if (el) el.style.fontSize = size + 'px'; }

    function bindSearch() {
        const input = document.getElementById('search-input');
        if (!input) return;
        let debounce;
        input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { searchQuery = input.value.trim(); renderSidebar(); }, 200); });
    }

    function bindSort() {
        const sel = document.getElementById('sort-select');
        if (!sel) return;
        sel.addEventListener('change', () => { sortOrder = sel.value; renderSidebar(); });
    }

    function bindAppShortcuts() {
        document.addEventListener('keydown', async (e) => {
            const meta = e.metaKey || e.ctrlKey;
            if (!meta) return;
            if (e.key === 'n' || e.key === 'N') { e.preventDefault(); await newEntry(); }
            if (e.key === 's' || e.key === 'S') { e.preventDefault(); await forceSave(); }
        });
    }

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) return;
            const cfg = await res.json();
            if (cfg.version) { appVersion = `v${cfg.version}`; setVersionDisplay(); }
            sortOrder = cfg.defaultSort || 'modified';
            FontSize = cfg.fontSize || 16;
            const sortSel = document.getElementById('sort-select');
            if (sortSel) sortSel.value = sortOrder;
        } catch { }
    }

    async function pollVersion() {
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) return;
            const cfg = await res.json();
            if (cfg.version && `v${cfg.version}` !== appVersion) { appVersion = `v${cfg.version}`; setVersionDisplay(); }
        } catch { }
    }

    async function init() {
        const ed = window.JournalEditor.init((html) => {
            if (!currentFilename) return;
            updateWordCount();
            persistCrashDraft();
            scheduleAutoSave();
        });
        if (!ed) console.error('Editor failed to initialize.');
        window.JournalEditor.bindKeyboardShortcuts?.();
        editorReady = true;
        await loadSettings();
        await loadEntries();
        bindSearch();
        bindSort();
        bindContextMenu();
        bindConflictDialog();
        bindAppShortcuts();
        connectSSE();
        setInterval(pollVersion, 30_000);
        document.getElementById('btn-new')?.addEventListener('click', newEntry);
        document.getElementById('btn-logout')?.addEventListener('click', async () => { await forceSave(); await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login'; });
        setTimeout(checkCrashRecovery, 800);
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }

    return { showToast, loadEntries };
})();
