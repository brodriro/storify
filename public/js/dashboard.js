(function () {
    'use strict';

    const status = document.getElementById('backupToast');
    let clearTimer = null;

    function showStatus(message) {
        if (!status) return;
        status.textContent = message;
        clearTimeout(clearTimer);
        clearTimer = setTimeout(() => (status.textContent = ''), 5000);
    }

    const button = document.getElementById('createBackupBtn');
    if (!button) return;

    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            const res = await fetch('/admin/backup', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (data.inProgress) showStatus(t('dashboard.inProgress'));
            else if (res.ok && data.success) showStatus(t('dashboard.started'));
            else showStatus(t('dashboard.failed'));
        } catch (e) {
            showStatus(t('dashboard.error'));
            console.error(e);
        } finally {
            button.disabled = false;
        }
    });
})();
