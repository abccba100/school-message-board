const form = document.getElementById('messageForm');
const roomKeyInput = document.getElementById('roomKey');
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const status = document.getElementById('status');
const charCount = document.getElementById('charCount');

// Load from localStorage
const savedRoomKey = localStorage.getItem('roomKey');
const savedName = localStorage.getItem('name');

if (savedRoomKey) roomKeyInput.value = savedRoomKey;
if (savedName) nameInput.value = savedName;

// Character count
messageInput.addEventListener('input', () => {
    charCount.textContent = messageInput.value.length;
});

let socket = null;
let sharedKey = '';

function connectSocket(roomKey, key) {
    if (socket) {
        socket.disconnect();
    }
    
    socket = io({
        auth: { roomKey, key }
    });

    socket.on('connect', () => {
        showStatus('연결됨', 'success');
        setTimeout(() => {
            status.style.display = 'none';
        }, 2000);
    });

    socket.on('connect_error', (error) => {
        showStatus('연결 실패: 잘못된 키 또는 룸 키', 'error');
    });

    socket.on('error', (data) => {
        showStatus(data.message || '오류 발생', 'error');
    });
}

// Connect on roomKey or sharedKey change
roomKeyInput.addEventListener('blur', () => {
    const roomKey = roomKeyInput.value.trim();
    const key = document.getElementById('sharedKey')?.value.trim() || '';
    if (roomKey && key) {
        localStorage.setItem('roomKey', roomKey);
        sharedKey = key;
        connectSocket(roomKey, key);
    }
});

const sharedKeyInput = document.getElementById('sharedKey');
if (sharedKeyInput) {
    sharedKeyInput.addEventListener('blur', () => {
        const roomKey = roomKeyInput.value.trim();
        const key = sharedKeyInput.value.trim();
        if (roomKey && key) {
            localStorage.setItem('roomKey', roomKey);
            sharedKey = key;
            connectSocket(roomKey, key);
        }
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const roomKey = roomKeyInput.value.trim();
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();
    const key = document.getElementById('sharedKey')?.value.trim() || '';
    
    if (!roomKey || !name || !message || !key) {
        showStatus('모든 필드를 입력해주세요.', 'error');
        return;
    }
    
    if (!socket || !socket.connected) {
        showStatus('서버에 연결되지 않았습니다.', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중...';
    
    // Save to localStorage
    localStorage.setItem('roomKey', roomKey);
    localStorage.setItem('name', name);
    sharedKey = key;
    
    socket.emit('sendMessage', { name, message }, (response) => {
        if (response && response.error) {
            showStatus(response.error, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '전송';
        } else {
            messageInput.value = '';
            charCount.textContent = '0';
            showStatus('전송 완료!', 'success');
            setTimeout(() => {
                status.style.display = 'none';
            }, 2000);
            submitBtn.disabled = false;
            submitBtn.textContent = '전송';
        }
    });
});

function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
    status.style.display = 'block';
}
