document.addEventListener('DOMContentLoaded', () => {
    const chatButton = document.getElementById('chat-button');
    const chatSidebar = document.getElementById('chat-sidebar');
    const closeChatButton = document.getElementById('close-chat');
    const chatMessageInput = document.getElementById('chat-message-input');
    const sendChatMessageButton = document.getElementById('send-chat-message');
    const chatHistory = document.getElementById('chat-history');
    const typingIndicator = document.getElementById('typing-indicator');

    let isChatInitialized = false;
    let responseTimer = null;
    let chatInfo = null; // { enabled, provider } sent by the server on connect
    const RESPONSE_TIMEOUT_MS = 90000;

    const socket = io({
        transports: ['websocket'],
        pingInterval: 25000,
        pingTimeout: 60000
    });

    // Auto-resize textarea
    chatMessageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        sendChatMessageButton.disabled = this.value.trim() === '';
    });

    // Closed, the panel is off-screen and inert, so Tab never lands inside it.
    function setChatOpen(open) {
        chatSidebar.classList.toggle('open', open);
        chatSidebar.inert = !open;
        chatButton.setAttribute('aria-expanded', String(open));
        if (open) {
            if (!isChatInitialized) {
                displayWelcomeMessage();
                isChatInitialized = true;
            }
            chatMessageInput.focus();
        }
    }

    chatButton.addEventListener('click', () => setChatOpen(!chatSidebar.classList.contains('open')));
    closeChatButton.addEventListener('click', () => {
        setChatOpen(false);
        chatButton.focus();
    });
    chatSidebar.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            setChatOpen(false);
            chatButton.focus();
        }
    });

    sendChatMessageButton.addEventListener('click', sendMessage);
    chatMessageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const message = chatMessageInput.value.trim();
        if (message) {
            appendMessage(message, 'user');
            chatMessageInput.value = '';
            chatMessageInput.style.height = 'auto'; // Reset height
            sendChatMessageButton.disabled = true;

            emitAndWait('chat', message);
        }
    }

    function emitAndWait(event, payload) {
        socket.emit(event, payload);
        toggleInputState(true);
        showTypingIndicator();
        clearTimeout(responseTimer);
        responseTimer = setTimeout(() => {
            finishWaiting();
            appendMessage(t('chat.noResponse'), 'ai');
        }, RESPONSE_TIMEOUT_MS);
    }

    function finishWaiting() {
        clearTimeout(responseTimer);
        hideTypingIndicator();
        toggleInputState(false);
    }

    socket.on('chatInfo', (info) => {
        chatInfo = info;
    });

    socket.on('chatResponse', (data) => {
        finishWaiting();
        appendMessage(String((data && data.response) || ''), 'ai');
        if (data && data.confirmation) appendConfirmation(data.confirmation);
        chatMessageInput.focus();
    });

    /** Confirm / cancel buttons for actions that change files (server waits for this). */
    let confirmSeq = 0;

    /** A CAUTION box: the proposed changes, signed off with Confirmar / Cancelar. */
    function appendConfirmation(confirmation) {
        const bar = document.createElement('div');
        bar.className = 'chat-confirm';
        bar.setAttribute('role', 'group');
        const labelId = `chat-confirm-${++confirmSeq}`;
        bar.setAttribute('aria-labelledby', labelId);
        const label = document.createElement('p');
        label.className = 'chat-confirm-label';
        label.id = labelId;
        // Drawn warning triangle (no glyph icons), then the label.
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const warn = document.createElementNS(SVG_NS, 'svg');
        warn.setAttribute('class', 'chat-confirm-icon');
        warn.setAttribute('viewBox', '0 0 24 24');
        warn.setAttribute('aria-hidden', 'true');
        for (const [tag, attrs] of [
            ['path', { d: 'M12 3 2 21h20L12 3z' }],
            ['line', { x1: 12, y1: 10, x2: 12, y2: 14 }],
            ['line', { x1: 12, y1: 17, x2: 12, y2: 18 }],
        ]) {
            const el = document.createElementNS(SVG_NS, tag);
            for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
            warn.appendChild(el);
        }
        label.append(warn, t('chat.caution'));
        const text = document.createElement('p');
        text.className = 'chat-confirm-text';
        text.textContent = t('chat.cautionText');
        const list = document.createElement('ul');
        list.className = 'chat-confirm-actions';
        for (const action of (confirmation && confirmation.actions) || []) {
            const item = document.createElement('li');
            item.textContent = String(action.summary || action.tool || '');
            list.appendChild(item);
        }
        const buttons = document.createElement('div');
        buttons.className = 'chat-confirm-buttons';
        const decide = (approved) => {
            bar.querySelectorAll('button').forEach((b) => (b.disabled = true));
            bar.dataset.decided = approved ? 'approved' : 'declined';
            emitAndWait('confirmAction', { id: confirmation.id, approved });
        };
        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'btn btn-primary btn-sm';
        confirmBtn.textContent = t('chat.confirm');
        confirmBtn.addEventListener('click', () => decide(true));
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary btn-sm';
        cancelBtn.textContent = t('chat.cancel');
        cancelBtn.addEventListener('click', () => decide(false));
        buttons.append(confirmBtn, cancelBtn);
        bar.append(label, text, list, buttons);
        chatHistory.appendChild(bar);
        scrollToBottom();
    }

    /** Plain-text notice (no Markdown/HTML), e.g. where data is sent. */
    function appendNotice(text) {
        const notice = document.createElement('p');
        notice.className = 'chat-notice';
        notice.textContent = text;
        chatHistory.appendChild(notice);
    }

    socket.on('disconnect', () => {
        if (!typingIndicator.classList.contains('visible')) return;
        finishWaiting();
        appendMessage(t('chat.disconnected'), 'ai');
    });

    function getTimestamp() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function appendMessage(message, sender) {
        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${sender}`;

        const meta = document.createElement('div');
        meta.className = 'msg-meta';
        const name = sender === 'user' ? t('chat.you') : t('chat.assistant');
        const nameEl = document.createElement('span');
        nameEl.textContent = name;
        const timeEl = document.createElement('span');
        timeEl.textContent = getTimestamp();
        meta.append(nameEl, ' · ', timeEl);

        const msgBubble = document.createElement('div');
        msgBubble.className = `chat-message ${sender}`;

        if (sender === 'ai') {
            // Model output is untrusted (it can echo document contents): sanitize.
            msgBubble.innerHTML = DOMPurify.sanitize(marked.parse(message));
        } else {
            msgBubble.textContent = message;
        }

        wrapper.appendChild(meta);
        wrapper.appendChild(msgBubble);

        chatHistory.appendChild(wrapper);
        scrollToBottom();
    }

    function scrollToBottom() {
        setTimeout(() => {
            chatHistory.scrollTo({
                top: chatHistory.scrollHeight,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            });
        }, 50);
    }

    function toggleInputState(disabled) {
        chatMessageInput.disabled = disabled;
        if (disabled) sendChatMessageButton.disabled = true;
    }

    function showTypingIndicator() {
        typingIndicator.classList.add('visible');
        scrollToBottom();
    }

    function hideTypingIndicator() {
        typingIndicator.classList.remove('visible');
    }

    function displayWelcomeMessage() {
        appendMessage(t('chat.welcome'), 'ai');
        if (chatInfo && !chatInfo.enabled) {
            appendNotice(t('chat.disabled'));
        } else if (chatInfo) {
            appendNotice(t('chat.providerNotice', { provider: chatInfo.provider }));
        }
    }
});
