/**
 * settings.js — Settings page logic
 */
function showToast(msg, isError = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' is-error' : '');
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
(async () => {
    try {
        const res = await fetch('/api/settings');
        if (res.status === 401) { window.location.href = '/login'; return; }
        const cfg = await res.json();
        document.getElementById('journal-path').value = cfg.journalPath || '';
        document.getElementById('default-sort').value = cfg.defaultSort || 'modified';
        document.getElementById('font-size').value = cfg.fontSize || 16;
        document.getElementById('font-size-value').textContent = `${cfg.fontSize || 16}px`;
        const sessionSel = document.getElementById('session-duration');
        const hours = cfg.sessionDurationHours || 24;
        for (const opt of sessionSel.options) { if (Number(opt.value) === hours) { opt.selected = true; break; } }
    } catch { showToast('Could not load settings.', true); }
})();
document.getElementById('font-size').addEventListener('input', (e) => { document.getElementById('font-size-value').textContent = `${e.target.value}px`; });
document.getElementById('btn-save-general').addEventListener('click', async () => {
    const journalPath = document.getElementById('journal-path').value.trim();
    const defaultSort = document.getElementById('default-sort').value;
    const fontSize = Number(document.getElementById('font-size').value);
    const sessionDurationHours = Number(document.getElementById('session-duration').value);
    const pathSuccess = document.getElementById('path-success');
    const pathError = document.getElementById('path-error');
    const genSuccess = document.getElementById('general-success');
    pathSuccess.classList.remove('is-visible'); pathError.classList.remove('is-visible'); genSuccess.classList.remove('is-visible');
    try {
        const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ journalPath, defaultSort, fontSize, sessionDurationHours }) });
        const data = await res.json();
        if (res.ok) { genSuccess.classList.add('is-visible'); setTimeout(() => genSuccess.classList.remove('is-visible'), 3000); }
        else { pathError.textContent = data.error || 'Could not save settings.'; pathError.classList.add('is-visible'); }
    } catch { showToast('Could not connect to server.', true); }
});
document.getElementById('btn-change-password').addEventListener('click', async () => {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const pwSuccess = document.getElementById('pw-success');
    const pwError = document.getElementById('pw-error');
    pwSuccess.classList.remove('is-visible'); pwError.classList.remove('is-visible');
    if (newPassword !== confirmPassword) { pwError.textContent = 'New passwords do not match.'; pwError.classList.add('is-visible'); return; }
    if (newPassword.length < 4) { pwError.textContent = 'Password must be at least 4 characters.'; pwError.classList.add('is-visible'); return; }
    try {
        const res = await fetch('/api/settings/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
        const data = await res.json();
        if (res.ok) { pwSuccess.classList.add('is-visible'); document.getElementById('current-password').value = ''; document.getElementById('new-password').value = ''; document.getElementById('confirm-password').value = ''; setTimeout(() => pwSuccess.classList.remove('is-visible'), 3000); }
        else { pwError.textContent = data.error || 'Could not change password.'; pwError.classList.add('is-visible'); }
    } catch { showToast('Could not connect to server.', true); }
});
document.getElementById('btn-logout-settings').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login'; });
