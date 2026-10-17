// Loaded synchronously in <head> so the theme applies before first paint.
// html[data-theme] holds the saved choice, or the system preference when
// nothing is saved; tokens.css styles both (and the no-JS case).
(function () {
    'use strict';

    const root = document.documentElement;

    function savedTheme() {
        try {
            const value = localStorage.getItem('theme');
            return value === 'dark' || value === 'light' ? value : null;
        } catch {
            return null;
        }
    }

    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    root.dataset.theme = savedTheme() || (systemDark.matches ? 'dark' : 'light');

    // Follow system changes until the user picks a theme explicitly.
    systemDark.addEventListener('change', (e) => {
        if (!savedTheme()) root.dataset.theme = e.matches ? 'dark' : 'light';
    });

    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        const sync = () => toggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
        sync();
        toggle.addEventListener('click', () => {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            root.dataset.theme = next;
            sync();
            try {
                localStorage.setItem('theme', next);
            } catch {
                /* storage unavailable: theme lasts for this page only */
            }
        });
    });
})();
