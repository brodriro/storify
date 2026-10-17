// File browser behaviour. All handlers are attached here (no inline JS) so the
// page can run under a strict Content-Security-Policy and file names are only
// ever treated as data (dataset / textContent), never as code or HTML.
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
            sessionStorageSafeSet('pendingToast', `${label}: ${result.failed.length} failed\n${detail}`);
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
        const shapes =
            type === 'error'
                ? [['circle', { cx: 12, cy: 12, r: 10 }], ['line', { x1: 15, y1: 9, x2: 9, y2: 15 }], ['line', { x1: 9, y1: 9, x2: 15, y2: 15 }]]
                : [['path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }], ['polyline', { points: '22 4 12 14.01 9 11.01' }]];
        for (const [tag, attrs] of shapes) {
            const el = document.createElementNS(SVG_NS, tag);
            for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
            svg.appendChild(el);
        }
        svg.style.color = type === 'error' ? '#ef4444' : 'var(--color-cta)';
        return svg;
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        const text = document.createElement('span');
        text.textContent = message;
        text.style.whiteSpace = 'pre-line';
        toast.append(icon(type), text);
        $('toastContainer').appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, type === 'error' ? 6000 : 3000);
    }

    // --- Prompt / confirm modal ---------------------------------------------

    let modalCallback = null;

    function openActionModal(title, text, type, callback, defaultValue = '') {
        $('actionModalTitle').textContent = title;
        $('actionModalText').textContent = text;
        const input = $('actionModalInput');
        input.style.display = type === 'prompt' ? 'block' : 'none';
        input.value = defaultValue;
        const confirmBtn = $('actionModalConfirmBtn');
        confirmBtn.className = /delete/i.test(title) ? 'btn btn-danger' : 'btn btn-primary';
        modalCallback = (value) => callback(type === 'prompt' ? value : true);
        $('actionModal').classList.add('active');
        (type === 'prompt' ? input : confirmBtn).focus();
    }

    function closeActionModal() {
        $('actionModal').classList.remove('active');
        $('actionModalInput').value = '';
        modalCallback = null;
    }

    $('actionModalConfirmBtn').addEventListener('click', () => {
        // Read the value before closing: closing clears the input.
        const callback = modalCallback;
        const value = $('actionModalInput').value;
        closeActionModal();
        if (callback) callback(value);
    });
    $('actionModalInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('actionModalConfirmBtn').click();
    });

    // --- Navigation ---------------------------------------------------------

    function goToPath(path) {
        const url = new URL('/files/browser', window.location.origin);
        if (path) url.searchParams.set('path', path);
        const current = new URL(window.location.href);
        for (const key of ['sort', 'order']) {
            const value = current.searchParams.get(key);
            if (value) url.searchParams.set(key, value);
        }
        window.location.href = url.toString();
    }

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
        if (selected.size > 0) {
            bar.style.display = 'flex';
            $('selectionCount').textContent = `${selected.size} selected`;
            document.body.classList.add('selection-mode');
        } else {
            bar.style.display = 'none';
            document.body.classList.remove('selection-mode');
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

    function showPreview(index) {
        const file = files[index];
        if (!file) return;
        previewIndex = index;
        $('modalTitle').textContent = file.name;
        $('modalDownloadLink').href = file.downloadUrl;
        const body = $('modalBody');
        body.replaceChildren();
        const ext = file.name.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) {
            const img = document.createElement('img');
            img.src = file.downloadUrl;
            img.alt = file.name;
            body.appendChild(img);
        } else if (['mp4', 'webm'].includes(ext)) {
            const video = document.createElement('video');
            video.src = file.downloadUrl;
            video.controls = true;
            body.appendChild(video);
        } else {
            const p = document.createElement('p');
            p.textContent = 'Preview not available for this file type.';
            body.appendChild(p);
        }
        const hasOthers = files.some((f, i) => i !== index && isPreviewable(f));
        $('modalNav').style.display = hasOthers ? 'flex' : 'none';
        $('previewModal').classList.add('active');
    }

    function navigatePreview(direction) {
        for (let i = previewIndex + direction; i >= 0 && i < files.length; i += direction) {
            if (isPreviewable(files[i])) return showPreview(i);
        }
    }

    function closePreview() {
        const modal = $('previewModal');
        modal.classList.remove('active');
        const video = modal.querySelector('video');
        if (video) video.pause();
    }

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
                    `Duplicate files renamed:\n${renamed.map((u) => `"${u.original}" -> "${u.final}"`).join('\n')}`,
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
            if (card.dataset.kind === 'dir') goToPath(card.dataset.path);
            else showPreview(files.findIndex((f) => f.path === card.dataset.path));
        },
        rename(card) {
            const name = card.dataset.name;
            openActionModal('Rename', 'Enter new name:', 'prompt', (newName) => {
                if (!newName || newName === name) return;
                run(async () => {
                    await api('/files/rename', 'POST', { path: card.dataset.path, newName });
                    window.location.reload();
                }, 'Rename failed');
            }, name);
        },
        move(card) {
            openActionModal('Move Item', "Enter destination folder (relative to root, e.g. 'photos'):", 'prompt', (destination) => {
                if (destination === null || destination === undefined) return;
                moveTo(card.dataset.path, destination);
            }, currentPath);
        },
        delete(card) {
            openActionModal('Delete File', `Are you sure you want to delete ${card.dataset.name}?`, 'confirm', () => {
                run(async () => {
                    await api('/files/delete', 'DELETE', { path: card.dataset.path });
                    window.location.reload();
                }, 'Delete failed');
            });
        },
        menu(card) {
            const menu = card.querySelector('.dropdown-content');
            document.querySelectorAll('.dropdown-content.show').forEach((el) => {
                if (el !== menu) el.classList.remove('show');
            });
            if (menu) menu.classList.toggle('show');
        },
    };

    const pageActions = {
        'toggle-order': () => {
            const order = new URL(window.location.href).searchParams.get('order') || 'asc';
            setQueryParam('order', order === 'asc' ? 'desc' : 'asc');
        },
        upload: () => $('fileInput').click(),
        'new-folder': () =>
            openActionModal('New Folder', 'Enter folder name:', 'prompt', (name) => {
                if (!name) return;
                run(async () => {
                    await api('/files/mkdir', 'POST', { path: currentPath, name });
                    window.location.reload();
                }, 'Could not create folder');
            }),
        go: (el) => goToPath(el.dataset.path),
        'close-preview': closePreview,
        'preview-prev': () => navigatePreview(-1),
        'preview-next': () => navigatePreview(1),
        'close-action-modal': closeActionModal,
        'clear-selection': () => {
            selected.clear();
            updateSelectionBar();
        },
        'bulk-delete': () => {
            if (!selected.size) return;
            openActionModal('Delete Selected', `Are you sure you want to delete ${selected.size} item(s)? This action cannot be undone.`, 'confirm', () => {
                run(async () => reportBulk(await api('/files/bulk-delete', 'POST', { paths: [...selected] }), 'Delete'), 'Bulk delete failed');
            });
        },
        'bulk-move': () => {
            if (!selected.size) return;
            openActionModal('Move Selected', `Enter destination path (relative to root) for ${selected.size} item(s):`, 'prompt', (destination) => {
                if (destination === null || destination === undefined) return;
                run(async () => reportBulk(await api('/files/bulk-move', 'POST', { paths: [...selected], destination }), 'Move'), 'Bulk move failed');
            }, currentPath);
        },
    };

    // --- Event delegation ---------------------------------------------------

    document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        const card = cardOf(e.target);

        // Overlay actions only fire on the backdrop itself, not inside the dialog.
        if (actionEl && actionEl.classList.contains('modal-overlay') && e.target !== actionEl) return;

        if (e.target.classList.contains('bulk-checkbox')) {
            e.stopPropagation();
            setSelected(card, e.target.checked);
            return;
        }

        if (actionEl) {
            const action = actionEl.dataset.action;
            if (actionEl.tagName === 'A') e.preventDefault();
            if (card && cardActions[action]) {
                e.stopPropagation();
                cardActions[action](card);
                return;
            }
            if (pageActions[action]) {
                pageActions[action](actionEl);
                return;
            }
        }

        if (card && !e.target.closest('.dropdown-content')) {
            if (document.body.classList.contains('selection-mode')) {
                setSelected(card, !selected.has(card.dataset.path));
            } else {
                cardActions.open(card);
            }
        }

        if (!card) {
            document.querySelectorAll('.dropdown-content.show').forEach((el) => el.classList.remove('show'));
        }
    });

    document.addEventListener('keydown', (e) => {
        if ($('previewModal').classList.contains('active')) {
            if (e.key === 'ArrowRight') navigatePreview(1);
            else if (e.key === 'ArrowLeft') navigatePreview(-1);
            else if (e.key === 'Escape') closePreview();
        } else if (e.key === 'Escape' && $('actionModal').classList.contains('active')) {
            closeActionModal();
        }
    });

    // Broken thumbnails fall back to the generic image icon ('error' doesn't bubble).
    document.addEventListener(
        'error',
        (e) => {
            const img = e.target;
            if (img.tagName === 'IMG' && img.classList.contains('file-thumbnail')) {
                img.style.display = 'none';
                if (img.nextElementSibling) img.nextElementSibling.style.display = 'block';
            }
        },
        true,
    );

    // --- Drag & drop --------------------------------------------------------

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

    // Messages queued before a reload (e.g. renamed duplicates).
    try {
        const pending = sessionStorage.getItem('pendingToast');
        if (pending) {
            sessionStorage.removeItem('pendingToast');
            showToast(pending, /failed/.test(pending) ? 'error' : 'success');
        }
    } catch {
        /* storage unavailable */
    }

})();
