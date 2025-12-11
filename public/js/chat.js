document.addEventListener('DOMContentLoaded', () => {
    const chatButton = document.getElementById('chat-button');
    const chatSidebar = document.getElementById('chat-sidebar');
    const closeChatButton = document.getElementById('close-chat');
    const chatMessageInput = document.getElementById('chat-message-input');
    const sendChatMessageButton = document.getElementById('send-chat-message');
    const chatHistory = document.getElementById('chat-history');

    const socket = io(); // Connect to Socket.io server

    chatButton.addEventListener('click', () => {
        chatSidebar.classList.toggle('open');
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
            socket.emit('chat',  message );
        }
    }

    // Listen for incoming messages from the server
    socket.on('chatResponse', (data) => {
        appendMessage(data.response, 'ai'); // Assuming the server sends a 'response' field
    });

    function appendMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender);
        messageElement.textContent = message;
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to bottom
    }
});
