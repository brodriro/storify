(function () {
    'use strict';

    const status = document.getElementById('backupToast');
    let clearTimer = null;

    function showStatus(message, sticky = false) {
        if (!status) return;
        status.textContent = message;
        clearTimeout(clearTimer);
        if (!sticky) clearTimer = setTimeout(() => (status.textContent = ''), 5000);
    }

    const button = document.getElementById('createBackupBtn');
    if (!button) return;

    // While a backup runs, check every few seconds and reload when it is done,
    // so the history shows it without the admin having to refresh.
    function watchUntilDone() {
        button.disabled = true;
        const timer = setInterval(async () => {
            try {
                const res = await fetch('/admin/backup/in-progress');
                const data = await res.json();
                if (!data.inProgress) {
                    clearInterval(timer);
                    window.location.reload();
                }
            } catch {
                /* transient: try again on the next tick */
            }
        }, 3000);
    }

    if (button.hasAttribute('data-running')) watchUntilDone();

    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            const res = await fetch('/admin/backup', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (data.inProgress) {
                showStatus(t('dashboard.inProgress'), true);
                watchUntilDone();
            } else if (res.ok && data.success) {
                showStatus(t('dashboard.started'), true);
                watchUntilDone();
            } else {
                showStatus(t('dashboard.failed'));
                button.disabled = false;
            }
        } catch (e) {
            showStatus(t('dashboard.error'));
            console.error(e);
            button.disabled = false;
        }
    });
})();
