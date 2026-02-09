// 다크모드 강제 해제
(function() {
    if (document.documentElement) {
        document.documentElement.style.colorScheme = 'light only';
        document.documentElement.style.setProperty('-webkit-color-scheme', 'light only', 'important');
        document.documentElement.style.setProperty('color-scheme', 'light only', 'important');
        document.documentElement.style.setProperty('background-color', '#ffe9f0', 'important');
        document.documentElement.style.setProperty('color', '#333333', 'important');
    }
    if (document.body) {
        document.body.style.setProperty('background', 'linear-gradient(135deg, #ffe9f0 0%, #fff4d9 40%, #e3f3ff 80%, #e5ddff 100%)', 'important');
        document.body.style.setProperty('background-color', '#ffe9f0', 'important');
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
})();

const form = document.getElementById('messageForm');
const messageInput = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const status = document.getElementById('status');
const charCount = document.getElementById('charCount');

let rafId = 0;
let lastNow = performance.now();
let typingAliveUntil = 0;
let statusHideAt = 0;

function tick(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    void dt;

    if (typingAliveUntil && now >= typingAliveUntil) {
        typingAliveUntil = 0;
        messageInput.classList.remove('typing-alive');
    }

    if (statusHideAt && now >= statusHideAt) {
        statusHideAt = 0;
        status.style.display = 'none';
    }

    rafId = requestAnimationFrame(tick);
}

rafId = requestAnimationFrame(tick);

// Character count
messageInput.addEventListener('input', () => {
    charCount.textContent = messageInput.value.length;
    
    // Give textarea a gentle "alive" motion while typing
    messageInput.classList.add('typing-alive');
    typingAliveUntil = performance.now() + 600;
});

let socket = null;

// Connect socket on page load
socket = io();

socket.on('connect', () => {
    showStatus('연결됨', 'success');
    statusHideAt = performance.now() + 2000;
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
    
    // 🎉 대포 발사!
    if (window.cannonEffect) {
        window.cannonEffect.fire(content);
    }
    
    socket.emit('sendMessage', { content }, (response) => {
        if (response && response.error) {
            showStatus(response.error, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '전송';
        } else {
            messageInput.value = '';X``
            charCount.textContent = '0';
            showStatus('전송 완료!', 'success');
            statusHideAt = performance.now() + 2000;
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