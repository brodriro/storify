document.addEventListener('DOMContentLoaded', () => {
    const chatButton = document.getElementById('chat-button');
    const chatSidebar = document.getElementById('chat-sidebar');
    const closeChatButton = document.getElementById('close-chat');
    const chatMessageInput = document.getElementById('chat-message-input');
    const sendChatMessageButton = document.getElementById('send-chat-message');
    const chatHistory = document.getElementById('chat-history');
    const typingIndicator = document.getElementById('typing-indicator');

    let isChatInitialized = false;

    const socket = io(); // Connect to Socket.io server

    chatButton.addEventListener('click', () => {
        chatSidebar.classList.toggle('open');
        if (chatSidebar.classList.contains('open') && !isChatInitialized) {
            displayWelcomeMessage();
            isChatInitialized = true;
        }
    });

    closeChatButton.addEventListener('click', () => {
        chatSidebar.classList.remove('open');
    });

    sendChatMessageButton.addEventListener('click', sendMessage);
    chatMessageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    async function sendMessage() {
        const message = chatMessageInput.value.trim();
        if (message) {
            appendMessage(message, 'user');
            chatMessageInput.value = '';

            // Emit the message over Socket.io
            socket.emit('chat', message);
            toggleInputState(true);
            showTypingIndicator();
        }
    }

    // Listen for incoming messages from the server
    socket.on('chatResponse', (data) => {
        hideTypingIndicator();
        toggleInputState(false);
        appendMessage(data.response, 'ai'); // Assuming the server sends a 'response' field
    });

    function appendMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender);
        
        if (sender === 'ai') {
            messageElement.innerHTML = marked.parse(message);
        } else {
            messageElement.textContent = message;
        }
        
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to bottom
    }

    function toggleInputState(disabled) {
        chatMessageInput.disabled = disabled;
        sendChatMessageButton.disabled = disabled;
    }

    function showTypingIndicator() {
        typingIndicator.classList.add('visible');
        chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to bottom to show indicator
    }

    function hideTypingIndicator() {
        typingIndicator.classList.remove('visible');
    }

    function displayWelcomeMessage() {
        const welcomeMessage = 'Hola, So tu asistente NAS Storify. Puedo ayudarte con las siguientes operaciones:\n' +
            '-   **Espacio disponible**\n' +
            '-   **Archivos recientes**\n' +
            '-   **Bakcups**\n' +
            '-   **Actividad sospechosa**';
        appendMessage(welcomeMessage, 'ai');
    }
});
