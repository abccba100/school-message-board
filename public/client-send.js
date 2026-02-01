const form = document.getElementById('messageForm');
const messageInput = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const status = document.getElementById('status');
const charCount = document.getElementById('charCount');

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
    
    const content = messageInput.value.trim();
    
    if (!content) {
        showStatus('메시지를 입력해주세요.', 'error');
        return;
    }
    
    if (!socket || !socket.connected) {
        showStatus('서버에 연결되지 않았습니다.', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중...';
    
    socket.emit('sendMessage', { content }, (response) => {
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
