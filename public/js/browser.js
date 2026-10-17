// File browser behaviour. All handlers are attached here (no inline JS) so the
// page can run under a strict Content-Security-Policy and file names are only
// ever treated as data (dataset / textContent), never as code or HTML.
//
// Keyboard model: folders and breadcrumbs are links; a file card is a button
// that opens the preview; ⋯ is a WAI-ARIA menu button (arrows, Home/End,
// Escape); dialogs are native <dialog> (focus trap, Escape, inert page).
(function () {
    'use strict';

    const data = JSON.parse(document.getElementById('browserData').textContent);
    const { currentPath, parentPath, canWrite, files } = data;
    const selected = new Set(); // relative paths
    let previewIndex = -1;

    const $ = (id) => document.getElementById(id);
    const cardOf = (el) => el.closest('.file-card[data-path]');
    const isPreviewable = (f) => f.isImage || f.isVideo;

    // --- Server calls -------------------------------------------------------

    /** JSON request that surfaces the server's error message. */
    async function api(url, method, body) {
        const init = { method, headers: {} };
        if (body instanceof FormData) {
            init.body = body;
        } else if (body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }
        const res = await fetch(url, init);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
            throw new Error(message || `Request failed (${res.status})`);
        }
        return payload;
    }

    async function run(action, errorLabel) {
        try {
            await action();
        } catch (error) {
            showToast(`${errorLabel}: ${error.message}`, 'error');
        }
    }

    function reportBulk(result, label) {
        if (result.failed && result.failed.length) {
            const detail = result.failed.map((f) => `${f.path}: ${f.error}`).join('\n');
            sessionStorageSafeSet('pendingToast', JSON.stringify({ type: 'error', message: `${label}: ${result.failed.length} failed\n${detail}` }));
        }
        window.location.reload();
    }

    function sessionStorageSafeSet(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch {
            /* storage unavailable: nothing to carry over */
        }
    }

    // --- Toasts -------------------------------------------------------------

    const SVG_NS = 'http://www.w3.org/2000/svg';
    function icon(type) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', `icon icon-sm toast-icon-${type}`);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        const shapes =
            type === 'error'
                ? [['circle', { cx: 12, cy: 12, r: 10 }], ['line', { x1: 15, y1: 9, x2: 9, y2: 15 }], ['line', { x1: 9, y1: 9, x2: 15, y2: 15 }]]
                : [['path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }], ['polyline', { points: '22 4 12 14.01 9 11.01' }]];
        for (const [tag, attrs] of shapes) {
            const el = document.createElementNS(SVG_NS, tag);
            for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
            svg.appendChild(el);
        }
        return svg;
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        const text = document.createElement('span');
        text.className = 'toast-text';
        text.textContent = message;
        toast.append(icon(type), text);
        $('toastContainer').appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, type === 'error' ? 6000 : 3000);
    }

    // --- Prompt / confirm dialog --------------------------------------------

    const actionModal = $('actionModal');
    const actionInput = $('actionModalInput');
    const actionConfirm = $('actionModalConfirmBtn');
    let modalCallback = null;

    function openActionModal(title, text, type, callback, defaultValue = '', danger = false) {
        $('actionModalTitle').textContent = title;
        $('actionModalText').textContent = text;
        actionInput.hidden = type !== 'prompt';
        actionInput.value = defaultValue;
        actionConfirm.className = danger ? 'btn btn-danger' : 'btn btn-primary';
        modalCallback = (value) => callback(type === 'prompt' ? value : true);
        actionModal.showModal();
        if (type === 'prompt') {
            actionInput.focus();
            actionInput.select();
        } else {
            actionConfirm.focus();
        }
    }

    // Submitting the form (button or Enter in the input) confirms.
    $('actionModalForm').addEventListener('submit', () => {
        const callback = modalCallback;
        const value = actionInput.value;
        modalCallback = null;
        if (callback) callback(value);
    });
    actionModal.addEventListener('close', () => {
        modalCallback = null;
    });

    // --- Navigation ---------------------------------------------------------

    function setQueryParam(key, value) {
        const url = new URL(window.location.href);
        url.searchParams.set(key, value);
        // A different order means different pages: start again from the first.
        url.searchParams.delete('page');
        window.location.href = url.toString();
    }

    $('sortSelect').addEventListener('change', (e) => setQueryParam('sort', e.target.value));

    // --- Selection ----------------------------------------------------------

    function updateSelectionBar() {
        const bar = $('selectionActionBar');
        bar.hidden = selected.size === 0;
        document.body.classList.toggle('selection-mode', selected.size > 0);
        if (selected.size > 0) {
            $('selectionCount').textContent = `${selected.size} selected`;
        } else {
            document.querySelectorAll('.bulk-checkbox').forEach((cb) => (cb.checked = false));
            document.querySelectorAll('.file-card.selected').forEach((c) => c.classList.remove('selected'));
        }
    }

    function setSelected(card, isSelected) {
        const checkbox = card.querySelector('.bulk-checkbox');
        if (!checkbox) return;
        checkbox.checked = isSelected;
        card.classList.toggle('selected', isSelected);
        if (isSelected) selected.add(card.dataset.path);
        else selected.delete(card.dataset.path);
        updateSelectionBar();
    }

    // --- Preview ------------------------------------------------------------

    const previewModal = $('previewModal');

    function showPreview(index) {
        const file = files[index];
        if (!file) return;
        previewIndex = index;
        $('modalTitle').textContent = file.name;
        $('modalDownloadLink').href = file.downloadUrl;
        const body = $('modalBody');
        body.replaceChildren();
        if (file.isImage) {
            const img = document.createElement('img');
            img.src = file.downloadUrl;
            img.alt = file.name;
            body.appendChild(img);
        } else if (file.isVideo) {
            const video = document.createElement('video');
            video.src = file.downloadUrl;
            video.controls = true;
            body.appendChild(video);
        } else {
            const p = document.createElement('p');
            p.textContent = 'Preview not available for this file type.';
            body.appendChild(p);
        }
        $('modalNav').hidden = !(isPreviewable(file) && files.some((f, i) => i !== index && isPreviewable(f)));
        if (!previewModal.open) previewModal.showModal();
    }

    function navigatePreview(direction) {
        for (let i = previewIndex + direction; i >= 0 && i < files.length; i += direction) {
            if (isPreviewable(files[i])) return showPreview(i);
        }
    }

    previewModal.addEventListener('close', () => {
        const video = previewModal.querySelector('video');
        if (video) video.pause();
        // Return focus to the card that opened the preview.
        const file = files[previewIndex];
        const card = file && document.querySelector(`.file-card[data-path="${CSS.escape(file.path)}"] .file-open`);
        if (card) card.focus();
    });
    previewModal.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') navigatePreview(1);
        else if (e.key === 'ArrowLeft') navigatePreview(-1);
    });

    // A click on the backdrop (the <dialog> itself, outside its content) closes it.
    for (const dialog of [previewModal, actionModal]) {
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
    }

    // --- Card menus (WAI-ARIA menu button) ----------------------------------

    function menuOf(toggle) {
        return $(toggle.getAttribute('aria-controls'));
    }

    function closeMenus(except) {
        document.querySelectorAll('.kebab-toggle[aria-expanded="true"]').forEach((toggle) => {
            if (toggle === except) return;
            toggle.setAttribute('aria-expanded', 'false');
            menuOf(toggle).hidden = true;
            toggle.closest('.file-card').classList.remove('menu-open');
        });
    }

    function openMenu(toggle, focusLast = false) {
        closeMenus(toggle);
        const menu = menuOf(toggle);
        toggle.setAttribute('aria-expanded', 'true');
        menu.hidden = false;
        toggle.closest('.file-card').classList.add('menu-open');
        const items = menu.querySelectorAll('[role="menuitem"]');
        items[focusLast ? items.length - 1 : 0].focus();
    }

    document.addEventListener('keydown', (e) => {
        const toggle = e.target.closest && e.target.closest('.kebab-toggle');
        if (toggle && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            openMenu(toggle, e.key === 'ArrowUp');
            return;
        }
        const menu = e.target.closest && e.target.closest('[role="menu"]');
        if (!menu) return;
        const items = [...menu.querySelectorAll('[role="menuitem"]')];
        const index = items.indexOf(e.target);
        const owner = $(menu.getAttribute('aria-labelledby'));
        const focusItem = (i) => items[(i + items.length) % items.length].focus();
        if (e.key === 'ArrowDown') focusItem(index + 1);
        else if (e.key === 'ArrowUp') focusItem(index - 1);
        else if (e.key === 'Home') focusItem(0);
        else if (e.key === 'End') focusItem(items.length - 1);
        else if (e.key === 'Escape' || e.key === 'Tab') {
            closeMenus();
            if (e.key === 'Escape') owner.focus();
            else return; // let Tab move on naturally
        } else return;
        e.preventDefault();
    });

    // --- File operations ----------------------------------------------------

    function uploadFiles(fileList) {
        if (!canWrite || !fileList || !fileList.length) return;
        const form = new FormData();
        Array.from(fileList).forEach((file) => form.append('files', file));
        form.append('path', currentPath);
        run(async () => {
            const result = await api('/files/upload', 'POST', form);
            const renamed = (result.uploaded || []).filter((u) => u.original !== u.final);
            if (renamed.length) {
                sessionStorageSafeSet(
                    'pendingToast',
                    JSON.stringify({
                        type: 'success',
                        message: `Duplicate files renamed:\n${renamed.map((u) => `"${u.original}" -> "${u.final}"`).join('\n')}`,
                    }),
                );
            }
            window.location.reload();
        }, 'Upload failed');
    }

    function moveTo(path, destination) {
        run(async () => {
            await api('/files/move', 'POST', { path, destination });
            window.location.reload();
        }, 'Move failed');
    }

    const cardActions = {
        open(card) {
            showPreview(files.findIndex((f) => f.path === card.dataset.path));
        },
        rename(card) {
            const name = card.dataset.name;
            openActionModal('Rename', 'New name:', 'prompt', (newName) => {
                if (!newName || newName === name) return;
                run(async () => {
                    await api('/files/rename', 'POST', { path: card.dataset.path, newName });
                    window.location.reload();
                }, 'Rename failed');
            }, name);
        },
        move(card) {
            openActionModal('Move', "Destination folder (relative to the root, e.g. 'photos'):", 'prompt', (destination) => {
                if (destination === null || destination === undefined) return;
                moveTo(card.dataset.path, destination);
            }, currentPath);
        },
        delete(card) {
            openActionModal('Delete', `Delete ${card.dataset.name}?`, 'confirm', () => {
                run(async () => {
                    await api('/files/delete', 'DELETE', { path: card.dataset.path });
                    window.location.reload();
                }, 'Delete failed');
            }, '', true);
        },
        menu(card, toggle) {
            if (toggle.getAttribute('aria-expanded') === 'true') closeMenus();
            else openMenu(toggle);
        },
    };

    const pageActions = {
        'toggle-order': () => {
            const order = new URL(window.location.href).searchParams.get('order') || 'asc';
            setQueryParam('order', order === 'asc' ? 'desc' : 'asc');
        },
        upload: () => $('fileInput').click(),
        'new-folder': () =>
            openActionModal('New folder', 'Folder name:', 'prompt', (name) => {
                if (!name) return;
                run(async () => {
                    await api('/files/mkdir', 'POST', { path: currentPath, name });
                    window.location.reload();
                }, 'Could not create folder');
            }),
        'close-preview': () => previewModal.close(),
        'preview-prev': () => navigatePreview(-1),
        'preview-next': () => navigatePreview(1),
        'close-action-modal': () => actionModal.close(),
        'clear-selection': () => {
            selected.clear();
            updateSelectionBar();
        },
        'bulk-delete': () => {
            if (!selected.size) return;
            openActionModal('Delete selection', `Delete ${selected.size} item(s)? This cannot be undone.`, 'confirm', () => {
                run(async () => reportBulk(await api('/files/bulk-delete', 'POST', { paths: [...selected] }), 'Delete'), 'Bulk delete failed');
            }, '', true);
        },
        'bulk-move': () => {
            if (!selected.size) return;
            openActionModal('Move selection', `Destination folder (relative to the root) for ${selected.size} item(s):`, 'prompt', (destination) => {
                if (destination === null || destination === undefined) return;
                run(async () => reportBulk(await api('/files/bulk-move', 'POST', { paths: [...selected], destination }), 'Move'), 'Bulk move failed');
            }, currentPath);
        },
    };

    // --- Event delegation ---------------------------------------------------

    document.addEventListener('click', (e) => {
        const card = cardOf(e.target);

        if (e.target.classList.contains('bulk-checkbox')) {
            setSelected(card, e.target.checked);
            return;
        }

        // While selecting, activating a card toggles it instead of opening it.
        const open = e.target.closest('.file-open');
        if (open && card && document.body.classList.contains('selection-mode')) {
            e.preventDefault();
            setSelected(card, !selected.has(card.dataset.path));
            return;
        }

        const actionEl = e.target.closest('[data-action]');
        if (actionEl) {
            const action = actionEl.dataset.action;
            if (card && cardActions[action]) {
                if (action !== 'menu') closeMenus();
                cardActions[action](card, actionEl);
                return;
            }
            if (pageActions[action]) {
                pageActions[action](actionEl);
                return;
            }
        }

        if (!e.target.closest('.file-menu')) closeMenus();
    });

    // Broken thumbnails fall back to the generic image icon ('error' doesn't bubble).
    document.addEventListener(
        'error',
        (e) => {
            const img = e.target;
            if (img.tagName === 'IMG' && img.classList.contains('file-thumbnail')) {
                img.hidden = true;
                if (img.nextElementSibling) img.nextElementSibling.hidden = false;
            }
        },
        true,
    );

    // --- Drag & drop (mouse shortcut; the ⋯ menu is the keyboard/touch path) --

    if (canWrite) {
        $('fileInput').addEventListener('change', (e) => uploadFiles(e.target.files));

        const dropZone = $('dropZone');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            // Internal drags (moving a card) are handled by the target below.
            if (e.dataTransfer.getData('application/x-storify-path')) return;
            uploadFiles(e.dataTransfer.files);
        });

        document.addEventListener('dragstart', (e) => {
            const card = cardOf(e.target);
            if (!card || card.dataset.kind !== 'file') return;
            e.dataTransfer.setData('application/x-storify-path', card.dataset.path);
            e.dataTransfer.effectAllowed = 'move';
        });

        const dropTargetOf = (el) => el.closest('.file-card[data-kind="dir"], [data-drop-target="parent"]');

        document.addEventListener('dragover', (e) => {
            const target = dropTargetOf(e.target);
            if (!target) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            target.classList.add('drag-over');
        });
        document.addEventListener('dragleave', (e) => {
            const target = dropTargetOf(e.target);
            if (target) target.classList.remove('drag-over');
        });
        document.addEventListener('drop', (e) => {
            const target = dropTargetOf(e.target);
            if (!target) return;
            e.preventDefault();
            e.stopPropagation();
            target.classList.remove('drag-over');
            const source = e.dataTransfer.getData('application/x-storify-path');
            if (!source) return;
            moveTo(source, target.dataset.dropTarget === 'parent' ? parentPath : target.dataset.path);
        });
    }

    // Messages queued before a reload (e.g. renamed duplicates, partial failures).
    try {
        const pending = sessionStorage.getItem('pendingToast');
        if (pending) {
            sessionStorage.removeItem('pendingToast');
            const { type, message } = JSON.parse(pending);
            showToast(message, type);
        }
    } catch {
        /* storage unavailable or old format */
    }
})();
