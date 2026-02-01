const form = document.getElementById('messageForm');
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const status = document.getElementById('status');
const charCount = document.getElementById('charCount');

// Load saved name from localStorage
const savedName = localStorage.getItem('name');
if (savedName) nameInput.value = savedName;

// Character count
messageInput.addEventListener('input', () => {
    charCount.textContent = messageInput.value.length;
});

let socket = null;

// Connect socket on page load
socket = io();

socket.on('connect', () => {
    showStatus('연결됨', 'success');
    setTimeout(() => {
        status.style.display = 'none';
    }, 2000);
});

socket.on('connect_error', (error) => {
    showStatus('연결 실패', 'error');
});

socket.on('error', (data) => {
    showStatus(data.message || '오류 발생', 'error');
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();
    
    if (!name || !message) {
        showStatus('이름과 메시지를 모두 입력해주세요.', 'error');
        return;
    }
    
    if (!socket || !socket.connected) {
        showStatus('서버에 연결되지 않았습니다.', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중...';
    
    // Save name to localStorage
    localStorage.setItem('name', name);
    
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
