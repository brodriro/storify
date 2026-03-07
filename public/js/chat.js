document.addEventListener('DOMContentLoaded', () => {
    const chatButton = document.getElementById('chat-button');
    const chatSidebar = document.getElementById('chat-sidebar');
    const closeChatButton = document.getElementById('close-chat');
    const chatMessageInput = document.getElementById('chat-message-input');
    const sendChatMessageButton = document.getElementById('send-chat-message');
    const chatHistory = document.getElementById('chat-history');
    const typingIndicator = document.getElementById('typing-indicator');

    let isChatInitialized = false;

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

    chatButton.addEventListener('click', () => {
        chatSidebar.classList.toggle('open');
        if (chatSidebar.classList.contains('open') && !isChatInitialized) {
            displayWelcomeMessage();
            isChatInitialized = true;
        }
        if (chatSidebar.classList.contains('open')) {
            setTimeout(() => chatMessageInput.focus(), 300);
        }
    });

    closeChatButton.addEventListener('click', () => {
        chatSidebar.classList.remove('open');
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

            socket.emit('chat', message);
            toggleInputState(true);
            showTypingIndicator();
        }
    }

    socket.on('chatResponse', (data) => {
        hideTypingIndicator();
        toggleInputState(false);
        appendMessage(data.response, 'ai');
        chatMessageInput.focus();
    });

    function getTimestamp() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function appendMessage(message, sender) {
        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${sender}`;

        const meta = document.createElement('div');
        meta.className = 'msg-meta';
        const name = sender === 'user' ? 'You' : 'Storify AI';
        meta.innerHTML = `<span>${name}</span> &middot; <span>${getTimestamp()}</span>`;

        const msgBubble = document.createElement('div');
        msgBubble.className = `chat-message ${sender}`;

        if (sender === 'ai') {
            msgBubble.innerHTML = marked.parse(message);
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
                behavior: 'smooth'
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
        const welcomeMessage = 'Hi! I am your Storify NAS Assistant. I can help you with:\n' +
            '-   **Available Space**\n' +
            '-   **Recent Files**\n' +
            '-   **System Backups**\n' +
            '-   **General questions**\n\nHow can I help you today?';
        appendMessage(welcomeMessage, 'ai');
    }
});
