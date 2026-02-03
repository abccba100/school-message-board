// 다크모드 강제 해제
(function() {
    if (document.documentElement) {
        document.documentElement.style.colorScheme = 'light only';
        document.documentElement.style.setProperty('-webkit-color-scheme', 'light only', 'important');
        document.documentElement.style.setProperty('color-scheme', 'light only', 'important');
        document.documentElement.style.setProperty('background-color', '#667eea', 'important');
        document.documentElement.style.setProperty('color', '#333333', 'important');
    }
    if (document.body) {
        document.body.style.setProperty('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'important');
        document.body.style.setProperty('background-color', '#667eea', 'important');
        document.body.style.setProperty('color', '#333333', 'important');
    }
    
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                if (document.documentElement) {
                    document.documentElement.style.colorScheme = 'light only';
                    document.documentElement.style.setProperty('-webkit-color-scheme', 'light only', 'important');
                }
            }
        });
    });
    
    if (document.documentElement) {
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }
    
    setInterval(function() {
        if (document.documentElement) {
            const computed = window.getComputedStyle(document.documentElement);
            if (computed.colorScheme !== 'light only' && computed.colorScheme !== 'light') {
                document.documentElement.style.colorScheme = 'light only';
                document.documentElement.style.setProperty('-webkit-color-scheme', 'light only', 'important');
            }
        }
    }, 100);
})();

const form = document.getElementById('messageForm');
const messageInput = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const status = document.getElementById('status');
const charCount = document.getElementById('charCount');

// Character count
messageInput.addEventListener('input', () => {
    charCount.textContent = messageInput.value.length;
    
    // Give textarea a gentle "alive" motion while typing
    messageInput.classList.add('typing-alive');
    if (messageInput._typingTimer) {
        clearTimeout(messageInput._typingTimer);
    }
    messageInput._typingTimer = setTimeout(() => {
        messageInput.classList.remove('typing-alive');
    }, 600);
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
