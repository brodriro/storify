(function () {
    'use strict';

    const toast = document.getElementById('backupToast');

    function showBackupToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => (toast.style.display = 'none'), 300);
        }, 3000);
    }

    const button = document.getElementById('createBackupBtn');
    if (!button) return;

    button.addEventListener('click', async () => {
        try {
            const res = await fetch('/admin/backup', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (data.inProgress) showBackupToast('Ya hay un backup ejecutándose.');
            else if (res.ok && data.success) showBackupToast('Backup iniciado. Se generará en segundo plano.');
            else showBackupToast('No se pudo iniciar el backup.');
        } catch (e) {
            showBackupToast('Error al iniciar el backup.');
            console.error(e);
        }
    });
})();
