const messagesContainer = document.getElementById('messages');
const roomKeyInput = document.getElementById('roomKeyInput');
const sharedKeyInput = document.getElementById('sharedKeyInput');
const joinBtn = document.getElementById('joinBtn');
const autoScrollToggle = document.getElementById('autoScrollToggle');
const status = document.getElementById('status');

let socket = null;
let currentRoomKey = null;
let autoScroll = true;

// Load saved roomKey
const savedRoomKey = localStorage.getItem('viewRoomKey');
if (savedRoomKey) {
    roomKeyInput.value = savedRoomKey;
}

autoScrollToggle.addEventListener('click', () => {
    autoScroll = !autoScroll;
    autoScrollToggle.textContent = autoScroll ? '자동 스크롤 ON' : '자동 스크롤 OFF';
    autoScrollToggle.classList.toggle('active', autoScroll);
});

joinBtn.addEventListener('click', () => {
    const roomKey = roomKeyInput.value.trim();
    const sharedKey = sharedKeyInput.value.trim();
    if (roomKey && sharedKey) {
        joinRoom(roomKey, sharedKey);
    } else {
        showStatus('룸 키와 공유 키를 모두 입력해주세요.', 'error');
    }
});

roomKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

sharedKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

function joinRoom(roomKey, sharedKey) {
    if (socket) {
        socket.disconnect();
    }

    currentRoomKey = roomKey;
    localStorage.setItem('viewRoomKey', roomKey);
    messagesContainer.innerHTML = '';
    showStatus('연결 중...', 'info');

    socket = io({
        auth: { roomKey, key: sharedKey }
    });

    socket.on('connect', async () => {
        showStatus('연결됨', 'success');
        setTimeout(() => {
            status.style.display = 'none';
        }, 2000);
        await loadInitialMessages(roomKey, sharedKey);
    });

    socket.on('connect_error', (error) => {
        showStatus('연결 실패: 잘못된 키 또는 룸 키', 'error');
        messagesContainer.innerHTML = '';
    });

    socket.on('newMessage', (message) => {
        if (message.roomKey === currentRoomKey) {
            addMessage(message, true);
        }
    });

    socket.on('disconnect', () => {
        showStatus('연결 끊김', 'error');
    });
}

async function loadInitialMessages(roomKey, sharedKey) {
    try {
        const response = await fetch(`/api/messages?roomKey=${encodeURIComponent(roomKey)}&key=${encodeURIComponent(sharedKey)}`);
        if (!response.ok) {
            throw new Error('Failed to load messages');
        }
        const messages = await response.json();
        messagesContainer.innerHTML = '';
        messages.forEach(msg => addMessage(msg, false));
        if (autoScroll) {
            scrollToBottom();
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        showStatus('메시지 로드 실패', 'error');
    }
}

function addMessage(message, isNew) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-item';
    
    const date = new Date(message.createdAt);
    const timeStr = date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-name">${escapeHtml(message.name)}</span>
            <span class="message-time">${escapeHtml(timeStr)}</span>
        </div>
        <div class="message-text">${escapeHtml(message.content)}</div>
    `;
    
    if (isNew) {
        messageDiv.classList.add('new-message');
        setTimeout(() => {
            messageDiv.classList.remove('new-message');
        }, 1000);
    }
    
    messagesContainer.appendChild(messageDiv);
    
    if (autoScroll) {
        scrollToBottom();
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
    status.style.display = 'block';
}
