/**
 * editor.js — TipTap editor initialization and toolbar logic.
 * Loaded before app.js; exposes window.JournalEditor.
 */

window.JournalEditor = (() => {
    'use strict';

    let editor = null;
    let lastUsedHighlight = '#FDE68A';
    let recentColors = JSON.parse(localStorage.getItem('lj_recent_colors') || '[]');
    let onChangeCallback = null;
    let cpHue = 0, cpSaturation = 0.7, cpValue = 0.4, cpDragging = false;

    function hsvToHex(h, s, v) {
        let r, g, b;
        const i = Math.floor(h / 60) % 6, f = h / 60 - Math.floor(h / 60);
        const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
        switch (i) {
            case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break; case 5: r = v; g = p; b = q; break;
        }
        return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    function hexToHsv(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        let h = 0, s = max === 0 ? 0 : d / max, v = max;
        if (d !== 0) { switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break; case g: h = ((b - r) / d + 2) * 60; break; case b: h = ((r - g) / d + 4) * 60; break; } }
        return { h, s, v };
    }

    function isValidHex(hex) { return /^#[0-9A-Fa-f]{6}$/.test(hex); }

    function updateColorPickerUI() {
        const hex = hsvToHex(cpHue, cpSaturation, cpValue);
        const field = document.getElementById('color-field');
        const cursor = document.getElementById('color-cursor');
        if (field) field.style.background = `hsl(${cpHue}, 100%, 50%)`;
        if (cursor) { cursor.style.left = (cpSaturation * 100) + '%'; cursor.style.top = ((1 - cpValue) * 100) + '%'; }
        const hexInput = document.getElementById('hex-input');
        const hexPreview = document.getElementById('hex-preview');
        if (hexInput) hexInput.value = hex;
        if (hexPreview) hexPreview.style.background = hex;
    }

    function initColorPickerEvents() {
        const field = document.getElementById('color-field');
        const hueSlider = document.getElementById('hue-slider');
        const hexInput = document.getElementById('hex-input');
        if (!field) return;
        function fieldPickAt(e) {
            const rect = field.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            cpSaturation = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            cpValue = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
            updateColorPickerUI();
        }
        field.addEventListener('mousedown', (e) => { cpDragging = true; fieldPickAt(e); e.preventDefault(); });
        document.addEventListener('mousemove', (e) => { if (cpDragging) fieldPickAt(e); });
        document.addEventListener('mouseup', () => { cpDragging = false; });
        if (hueSlider) hueSlider.addEventListener('input', (e) => { cpHue = Number(e.target.value); updateColorPickerUI(); });
        if (hexInput) {
            hexInput.addEventListener('input', (e) => {
                const val = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
                if (isValidHex(val)) {
                    const hsv = hexToHsv(val); cpHue = hsv.h; cpSaturation = hsv.s; cpValue = hsv.v;
                    document.getElementById('hex-preview').style.background = val;
                    const sl = document.getElementById('hue-slider');
                    if (sl) sl.value = hsv.h;
                }
            });
        }
        document.getElementById('btn-apply-color')?.addEventListener('click', () => { applyFontColor(hsvToHex(cpHue, cpSaturation, cpValue)); closeAllDropdowns(); });
        document.getElementById('btn-remove-color')?.addEventListener('click', () => { editor.chain().focus().unsetColor().run(); closeAllDropdowns(); });
    }

    function addRecentColor(hex) {
        recentColors = [hex, ...recentColors.filter(c => c !== hex)].slice(0, 8);
        localStorage.setItem('lj_recent_colors', JSON.stringify(recentColors));
        renderRecentColors();
    }

    function renderRecentColors() {
        const container = document.getElementById('recent-colors');
        if (!container) return;
        container.innerHTML = '';
        recentColors.forEach(hex => {
            const dot = document.createElement('button');
            dot.className = 'recent-color-dot';
            dot.style.background = hex;
            dot.title = hex;
            dot.addEventListener('click', () => { applyFontColor(hex); closeAllDropdowns(); });
            container.appendChild(dot);
        });
    }

    function applyFontColor(hex) { editor.chain().focus().setColor(hex).run(); addRecentColor(hex); }

    const DROPDOWNS = ['para', 'highlight', 'color', 'list', 'table'];

    function closeAllDropdowns(except = '') {
        DROPDOWNS.forEach(id => {
            if (id !== except) { document.getElementById(`${id}-menu`)?.classList.add('is-hidden'); document.getElementById(`btn-${id}`)?.setAttribute('aria-expanded', 'false'); }
        });
        document.getElementById('link-dialog')?.classList.add('is-hidden');
    }

    function toggleDropdown(id) {
        const menu = document.getElementById(`${id}-menu`);
        if (!menu) return;
        const isOpen = !menu.classList.contains('is-hidden');
        closeAllDropdowns();
        if (!isOpen) {
            menu.classList.remove('is-hidden');
            document.getElementById(`btn-${id}`)?.setAttribute('aria-expanded', 'true');
            if (id === 'color') { updateColorPickerUI(); renderRecentColors(); }
        }
    }

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('[id^="dd-"]') && !e.target.closest('[id$="-menu"]')) closeAllDropdowns();
        if (!e.target.closest('#link-dialog') && !e.target.closest('#btn-link')) document.getElementById('link-dialog')?.classList.add('is-hidden');
        if (!e.target.closest('#context-menu')) document.getElementById('context-menu')?.classList.add('is-hidden');
    });

    function initTableGrid() {
        const grid = document.getElementById('table-grid');
        const label = document.getElementById('table-grid-label');
        if (!grid) return;
        const COLS = 6, ROWS = 5;
        grid.innerHTML = '';
        for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'table-grid__cell';
            cell.dataset.row = r; cell.dataset.col = c;
            grid.appendChild(cell);
        }
        grid.addEventListener('mouseover', (e) => {
            const target = e.target.closest('.table-grid__cell');
            if (!target) return;
            const r = Number(target.dataset.row), c = Number(target.dataset.col);
            grid.querySelectorAll('.table-grid__cell').forEach(cell => cell.classList.toggle('is-highlighted', Number(cell.dataset.row) <= r && Number(cell.dataset.col) <= c));
            if (label) label.textContent = `${r} × ${c}`;
        });
        grid.addEventListener('mouseleave', () => { grid.querySelectorAll('.table-grid__cell').forEach(c => c.classList.remove('is-highlighted')); if (label) label.textContent = '–'; });
        grid.addEventListener('click', (e) => {
            const target = e.target.closest('.table-grid__cell');
            if (!target) return;
            editor.chain().focus().insertTable({ rows: Number(target.dataset.row), cols: Number(target.dataset.col), withHeaderRow: true }).run();
            closeAllDropdowns();
        });
    }

    function updateToolbarState() {
        if (!editor) return;
        const setActive = (id, active) => document.getElementById(id)?.classList.toggle('is-active', active);
        setActive('btn-bold', editor.isActive('bold'));
        setActive('btn-italic', editor.isActive('italic'));
        setActive('btn-underline', editor.isActive('underline'));
        setActive('btn-strike', editor.isActive('strike'));
        setActive('btn-highlight', editor.isActive('highlight'));
        setActive('btn-blockquote', editor.isActive('blockquote'));
        let paraLabel = 'Body';
        if (editor.isActive('heading', { level: 1 })) paraLabel = 'Title';
        else if (editor.isActive('heading', { level: 2 })) paraLabel = 'Heading';
        else if (editor.isActive('heading', { level: 3 })) paraLabel = 'Subheading';
        else if (editor.isActive('codeBlock')) paraLabel = 'Monospaced';
        const paraEl = document.getElementById('para-label');
        if (paraEl) paraEl.textContent = paraLabel;
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');
        if (undoBtn) undoBtn.disabled = !editor.can().undo();
        if (redoBtn) redoBtn.disabled = !editor.can().redo();
    }

    function init(onChange) {
        onChangeCallback = onChange;
        const B = window.TiptapBundle;
        if (!B || !B.Editor || !B.StarterKit) { console.error('TipTap bundle not loaded.'); return null; }
        const extensions = [
            B.StarterKit.configure({ codeBlock: false, underline: false, link: false }),
            B.Underline, B.TextStyle, B.Color,
            B.Highlight.configure({ multicolor: true }),
            B.Table.configure({ resizable: true }),
            B.TableRow, B.TableCell, B.TableHeader,
            B.Link.configure({ openOnClick: false }),
            B.Image.configure({ inline: false }),
            B.CodeBlock,
            B.Placeholder.configure({ placeholder: 'Begin writing…' }),
        ].filter(Boolean);
        editor = new B.Editor({
            element: document.getElementById('tiptap-editor'),
            extensions,
            content: '',
            editorProps: { attributes: { class: 'ProseMirror', 'data-testid': 'editor' } },
            onUpdate: () => { updateToolbarState(); if (onChangeCallback) onChangeCallback(editor.getHTML()); },
            onSelectionUpdate: () => updateToolbarState(),
            onTransaction: () => updateToolbarState(),
        });
        bindToolbar();
        initColorPickerEvents();
        initTableGrid();
        updateColorPickerUI();
        return editor;
    }

    function bindToolbar() {
        const b = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
        b('btn-bold', () => editor.chain().focus().toggleBold().run());
        b('btn-italic', () => editor.chain().focus().toggleItalic().run());
        b('btn-underline', () => editor.chain().focus().toggleUnderline().run());
        b('btn-strike', () => editor.chain().focus().toggleStrike().run());
        b('btn-blockquote', () => editor.chain().focus().toggleBlockquote().run());
        b('btn-hr', () => editor.chain().focus().setHorizontalRule().run());
        b('btn-undo', () => editor.chain().focus().undo().run());
        b('btn-redo', () => editor.chain().focus().redo().run());
        b('btn-para', () => toggleDropdown('para'));
        document.getElementById('para-menu')?.addEventListener('click', (e) => {
            const target = e.target.closest('.toolbar__dropdown-item');
            if (!target) return;
            if (target.dataset.heading) editor.chain().focus().toggleHeading({ level: Number(target.dataset.heading) }).run();
            else if (target.dataset.para === 'body') editor.chain().focus().setParagraph().run();
            else if (target.dataset.para === 'code') editor.chain().focus().toggleCodeBlock().run();
            closeAllDropdowns();
        });
        b('btn-highlight', (e) => { e.stopPropagation(); toggleDropdown('highlight'); });
        document.getElementById('highlight-menu')?.addEventListener('click', (e) => {
            const swatch = e.target.closest('.highlight-swatch');
            if (!swatch) return;
            const color = swatch.dataset.color;
            if (color === 'none') editor.chain().focus().unsetHighlight().run();
            else { lastUsedHighlight = color; editor.chain().focus().setHighlight({ color }).run(); }
            closeAllDropdowns();
        });
        b('btn-color', () => toggleDropdown('color'));
        b('btn-list', () => toggleDropdown('list'));
        b('btn-bullet', () => { editor.chain().focus().toggleBulletList().run(); closeAllDropdowns(); });
        b('btn-dashed', () => { editor.chain().focus().toggleBulletList().run(); closeAllDropdowns(); });
        b('btn-ordered', () => { editor.chain().focus().toggleOrderedList().run(); closeAllDropdowns(); });
        b('btn-table', () => toggleDropdown('table'));
        b('btn-add-row', () => { editor.chain().focus().addRowAfter().run(); closeAllDropdowns(); });
        b('btn-del-row', () => { editor.chain().focus().deleteRow().run(); closeAllDropdowns(); });
        b('btn-add-col', () => { editor.chain().focus().addColumnAfter().run(); closeAllDropdowns(); });
        b('btn-del-col', () => { editor.chain().focus().deleteColumn().run(); closeAllDropdowns(); });
        b('btn-del-table', () => { editor.chain().focus().deleteTable().run(); closeAllDropdowns(); });
        b('btn-link', () => {
            const linkDialog = document.getElementById('link-dialog');
            const input = document.getElementById('link-url-input');
            if (linkDialog.classList.contains('is-hidden')) {
                input.value = editor.getAttributes('link').href || '';
                const btnRect = document.getElementById('btn-link').getBoundingClientRect();
                linkDialog.style.top = (btnRect.bottom + 6) + 'px';
                linkDialog.style.left = btnRect.left + 'px';
                linkDialog.classList.remove('is-hidden');
                input.focus();
            } else { linkDialog.classList.add('is-hidden'); }
        });
        b('btn-link-apply', () => { const url = document.getElementById('link-url-input').value.trim(); if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(); document.getElementById('link-dialog').classList.add('is-hidden'); });
        b('btn-link-remove', () => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); document.getElementById('link-dialog').classList.add('is-hidden'); });
        b('btn-link-cancel', () => { document.getElementById('link-dialog').classList.add('is-hidden'); });
        document.getElementById('link-url-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('btn-link-apply').click(); });
        b('btn-image', () => document.getElementById('image-file-input').click());
        document.getElementById('image-file-input')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            const formData = new FormData(); formData.append('file', file);
            try {
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                const data = await res.json();
                if (res.ok) editor.chain().focus().setImage({ src: data.url }).run();
                else window.JournalApp?.showToast('Image upload failed: ' + data.error, true);
            } catch { window.JournalApp?.showToast('Image upload failed.', true); }
            e.target.value = '';
        });
        document.getElementById('tiptap-editor')?.addEventListener('drop', async (e) => {
            const file = e.dataTransfer?.files?.[0]; if (!file) return;
            const allowed = ['image/jpeg', 'image/png', 'image/pdf', 'image/heic', 'application/pdf'];
            if (!allowed.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf|heic)$/i)) { window.JournalApp?.showToast('Unsupported file type.', true); return; }
            e.preventDefault();
            const formData = new FormData(); formData.append('file', file);
            try { const res = await fetch('/api/upload', { method: 'POST', body: formData }); const data = await res.json(); if (res.ok) editor.chain().focus().setImage({ src: data.url }).run(); } catch { }
        });
    }

    function bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!editor) return;
            const meta = e.metaKey || e.ctrlKey;
            if (!meta) return;
            if (e.shiftKey) {
                switch (e.key) {
                    case 'H': case 'h': e.preventDefault(); editor.chain().focus().toggleHighlight({ color: lastUsedHighlight }).run(); break;
                    case 'C': case 'c': e.preventDefault(); toggleDropdown('color'); break;
                    case '1': e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
                    case '2': e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
                    case '3': e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
                    case '0': e.preventDefault(); editor.chain().focus().setParagraph().run(); break;
                    case '7': e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); break;
                    case '8': e.preventDefault(); editor.chain().focus().toggleBulletList().run(); break;
                    case '.': e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); break;
                }
            } else { if (e.key === 'k' || e.key === 'K') { e.preventDefault(); document.getElementById('btn-link')?.click(); } }
        });
    }

    return {
        init,
        getHTML: () => editor?.getHTML() || '',
        setContent: (html) => editor?.commands.setContent(html, false),
        clearContent: () => editor?.commands.clearContent(),
        focus: () => editor?.commands.focus(),
        isReady: () => !!editor,
        bindKeyboardShortcuts,
    };
})();
