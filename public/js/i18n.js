// UI strings for the page scripts (D5). The catalog lives in src/i18n/es.ts;
// the layout embeds its `client` part as inert JSON. t('browser.renameTitle')
// or t('browser.selectedCount', { count: 3 }).
(function () {
    'use strict';

    let messages = {};
    try {
        messages = JSON.parse(document.getElementById('i18n').textContent);
    } catch {
        /* no catalog: keys are shown as they are */
    }

    window.t = function (key, params) {
        let node = messages;
        for (const part of key.split('.')) node = node && typeof node === 'object' ? node[part] : undefined;
        const template = typeof node === 'string' ? node : key;
        return template.replace(/\{(\w+)\}/g, (match, name) =>
            params && name in params ? String(params[name]) : match,
        );
    };
})();
