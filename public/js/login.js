/**
 * login.js — Login page logic
 */
(async () => {
    const loginForm = document.getElementById('login-form');
    const setupForm = document.getElementById('setup-form');
    const errorMsg = document.getElementById('error-msg');
    const subtitle = document.getElementById('subtitle');
    function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.add('is-visible'); }
    function hideError() { errorMsg.classList.remove('is-visible'); }
    let firstRun = false;
    try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        if (data.authenticated) { window.location.href = '/'; return; }
        firstRun = data.firstRun;
    } catch (e) { console.error('Could not reach server:', e); }
    if (firstRun) { loginForm.style.display = 'none'; setupForm.style.display = ''; subtitle.textContent = 'Welcome! Set a password to protect your journal.'; }
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); hideError();
        const password = document.getElementById('login-password').value;
        try {
            const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
            const data = await res.json();
            if (res.ok) { window.location.href = '/'; }
            else { showError(data.error || 'Incorrect password.'); document.getElementById('login-password').value = ''; document.getElementById('login-password').focus(); }
        } catch { showError('Could not connect to the server.'); }
    });
    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); hideError();
        const password = document.getElementById('setup-password').value;
        const confirm = document.getElementById('setup-confirm').value;
        if (password !== confirm) { showError('Passwords do not match.'); return; }
        if (password.length < 4) { showError('Password must be at least 4 characters.'); return; }
        try {
            const res = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
            const data = await res.json();
            if (res.ok) { window.location.href = '/'; } else { showError(data.error || 'Could not set password.'); }
        } catch { showError('Could not connect to the server.'); }
    });
})();
