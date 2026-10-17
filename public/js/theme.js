// Loaded synchronously at the top of <body> so the saved theme applies before
// first paint; also wires the header toggle button.
(function () {
    'use strict';

    function readTheme() {
        try {
            return localStorage.getItem('theme');
        } catch {
            return null;
        }
    }

    if (readTheme() === 'dark') document.body.classList.add('dark');

    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            const dark = document.body.classList.toggle('dark');
            try {
                localStorage.setItem('theme', dark ? 'dark' : 'light');
            } catch {
                /* storage unavailable: theme lasts for this page only */
            }
        });
    });
})();
