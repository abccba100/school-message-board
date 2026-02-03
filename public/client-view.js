// ============================================
// 조절 가능한 파라미터 목록
// ============================================
// 색상 관련:
//   - hue: 0~360 (HSL 색상의 색상각)
//   - saturation: 40~60% (채도 범위)
//   - lightness: 70~85% (명도 범위)
//   - gradient offset: 30% 30% (그라디언트 중심 위치)
//   - darkerColor offset: -8% (어두운 색상 명도 차이)
//   - borderColor offset: -12% (테두리 색상 명도 차이)
//
// 움직임 관련:
//   - damping: 0.995 (속도 감쇠 계수, 높을수록 덜 감쇠)
//   - noiseSpeed: 0.01~0.03 (노이즈 속도 범위)
//   - noiseForce: 0.002 (노이즈 힘의 크기)
//   - minSpeed: 0.01 (최소 속도 임계값)
//   - minSpeedForce: minSpeed * 0.5 (최소 속도일 때 부여하는 힘)
//   - boundaryBounce: 0.8 (경계 충돌 시 반사 계수)
//   - collisionDamping: 0.9 (충돌 시 속도 감쇠)
//
// 풍선 크기:
//   - minRadius: 40 (최소 반지름)
//   - maxRadius: 100 (최대 반지름)
//   - sizeMultiplier: 3 (텍스트 길이에 따른 크기 배수)
// ============================================

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

const ballContainer = document.getElementById('ballContainer');
const status = document.getElementById('status');

let socket = null;
let balls = [];
let animationId = null;
let containerWidth = 0;
let containerHeight = 0;

// Ball class
class Ball {
    constructor(id, content, x, y) {
        this.id = id;
        this.content = content;
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.max(40, Math.min(100, content.length * 3 + 40));
        this.element = null;
        
        // Generate pastel color
        this.hue = Math.random() * 360;
        this.saturation = 40 + Math.random() * 20; // 40-60%
        this.lightness = 70 + Math.random() * 15; // 70-85%
        
        // Noise parameters for continuous movement
        this.noiseX = Math.random() * Math.PI * 2;
        this.noiseY = Math.random() * Math.PI * 2;
        this.noiseSpeed = 0.01 + Math.random() * 0.02; // 0.01-0.03
        
        this.createElement();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'message-ball';
        this.element.textContent = this.content;
        this.element.style.width = (this.radius * 2) + 'px';
        this.element.style.height = (this.radius * 2) + 'px';
        this.element.style.left = (this.x - this.radius) + 'px';
        this.element.style.top = (this.y - this.radius) + 'px';
        
        // Apply pastel color with gradient (RGB로 변환하여 다크모드 반전 방지)
        const baseColorRgb = this.hslToRgb(this.hue, this.saturation, this.lightness);
        const darkerColorRgb = this.hslToRgb(this.hue, this.saturation, this.lightness - 8);
        const borderColorRgb = this.hslToRgb(this.hue, this.saturation, this.lightness - 12);
        
        const baseColor = `rgb(${baseColorRgb.r}, ${baseColorRgb.g}, ${baseColorRgb.b})`;
        const darkerColor = `rgb(${darkerColorRgb.r}, ${darkerColorRgb.g}, ${darkerColorRgb.b})`;
        const borderColor = `rgb(${borderColorRgb.r}, ${borderColorRgb.g}, ${borderColorRgb.b})`;
        
        this.element.style.background = `radial-gradient(circle at 30% 30%, ${baseColor}, ${darkerColor})`;
        this.element.style.borderColor = borderColor;
        this.element.style.setProperty('background', `radial-gradient(circle at 30% 30%, ${baseColor}, ${darkerColor})`, 'important');
        this.element.style.setProperty('background-color', baseColor, 'important');
        this.element.style.setProperty('border-color', borderColor, 'important');
        this.element.style.setProperty('color', '#333333', 'important');
        this.element.style.setProperty('-webkit-color-scheme', 'light only', 'important');
        this.element.style.setProperty('color-scheme', 'light only', 'important');
        this.element.style.setProperty('-webkit-forced-color-adjust', 'none', 'important');
        this.element.style.setProperty('forced-color-adjust', 'none', 'important');
        this.element.style.setProperty('color-adjust', 'exact', 'important');
        this.element.style.setProperty('filter', 'none', 'important');
        this.element.style.setProperty('backdrop-filter', 'none', 'important');
        
        ballContainer.appendChild(this.element);
    }
    
    hslToRgb(h, s, l) {
        h = h / 360;
        s = s / 100;
        l = l / 100;
        
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    update() {
        // Apply gentle damping (less aggressive)
        this.vx *= 0.995;
        this.vy *= 0.995;

        // Add subtle noise for continuous movement
        this.noiseX += this.noiseSpeed;
        this.noiseY += this.noiseSpeed;
        
        // Generate smooth noise using sine waves
        const noiseForceX = Math.sin(this.noiseX) * 0.002;
        const noiseForceY = Math.cos(this.noiseY) * 0.002;
        
        this.vx += noiseForceX;
        this.vy += noiseForceY;

        // Minimum speed check - if too slow, add small random force
        const minSpeed = 0.01;
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        if (currentSpeed < minSpeed) {
            const angle = Math.random() * Math.PI * 2;
            const force = minSpeed * 0.5;
            this.vx += Math.cos(angle) * force;
            this.vy += Math.sin(angle) * force;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Boundary collision
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx = -this.vx * 0.8;
        }
        if (this.x + this.radius > containerWidth) {
            this.x = containerWidth - this.radius;
            this.vx = -this.vx * 0.8;
        }
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy = -this.vy * 0.8;
        }
        if (this.y + this.radius > containerHeight) {
            this.y = containerHeight - this.radius;
            this.vy = -this.vy * 0.8;
        }

        // Update DOM position
        this.element.style.left = (this.x - this.radius) + 'px';
        this.element.style.top = (this.y - this.radius) + 'px';
    }

    checkCollision(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = this.radius + other.radius;

        if (distance < minDistance && distance > 0) {
            // Collision detected
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            // Rotate velocities
            const vx1 = this.vx * cos + this.vy * sin;
            const vy1 = this.vy * cos - this.vx * sin;
            const vx2 = other.vx * cos + other.vy * sin;
            const vy2 = other.vy * cos - other.vx * sin;

            // Separate balls
            const overlap = minDistance - distance;
            const separationX = (dx / distance) * overlap * 0.5;
            const separationY = (dy / distance) * overlap * 0.5;
            
            this.x -= separationX;
            this.y -= separationY;
            other.x += separationX;
            other.y += separationY;

            // Simple collision response (swap velocities in rotated space)
            const finalVx1 = vx2;
            const finalVx2 = vx1;

            // Rotate back
            this.vx = finalVx1 * cos - vy1 * sin;
            this.vy = vy1 * cos + finalVx1 * sin;
            other.vx = finalVx2 * cos - vy2 * sin;
            other.vy = vy2 * cos + finalVx2 * sin;

            // Apply damping
            this.vx *= 0.9;
            this.vy *= 0.9;
            other.vx *= 0.9;
            other.vy *= 0.9;

            // Soft squish animation on collision
            this.squish();
            other.squish();
        }
    }

    applyForce(fx, fy) {
        this.vx += fx;
        this.vy += fy;
    }

    squish() {
        if (!this.element) return;
        this.element.classList.remove('bump');
        // Force reflow to restart animation
        // eslint-disable-next-line no-unused-expressions
        this.element.offsetWidth;
        this.element.classList.add('bump');
    }

    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// Update container size
function updateContainerSize() {
    containerWidth = window.innerWidth;
    containerHeight = window.innerHeight;
    ballContainer.style.width = containerWidth + 'px';
    ballContainer.style.height = containerHeight + 'px';
}

// Animation loop
function animate() {
    // Update all balls
    balls.forEach(ball => ball.update());

    // Check collisions between all pairs
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            balls[i].checkCollision(balls[j]);
        }
    }

    animationId = requestAnimationFrame(animate);
}

// Add new ball at center
function addBall(message, isNew = false) {
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    const ball = new Ball(message.id, message.content, centerX, centerY);
    
    if (isNew) {
        // Give initial random velocity
        ball.vx = (Math.random() - 0.5) * 2;
        ball.vy = (Math.random() - 0.5) * 2;
        
        // Push away existing balls
        balls.forEach(existingBall => {
            const dx = existingBall.x - centerX;
            const dy = existingBall.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 200 && distance > 0) {
                const force = 0.3 / (distance / 100);
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                existingBall.applyForce(fx, fy);
            }
        });

        // Soft pop-in for the new message
        if (ball.element) {
            ball.element.classList.add('new-born');
            setTimeout(() => {
                if (ball.element) {
                    ball.element.classList.remove('new-born');
                }
            }, 800);
        }
    }
    
    balls.push(ball);
}

// Initialize
updateContainerSize();
window.addEventListener('resize', () => {
    updateContainerSize();
});

// Connect socket
socket = io();

socket.on('connect', async () => {
    showStatus('연결됨', 'success');
    setTimeout(() => {
        status.style.display = 'none';
    }, 2000);
    await loadInitialMessages();
    if (animationId === null) {
        animate();
    }
});

socket.on('connect_error', (error) => {
    showStatus('연결 실패', 'error');
});

socket.on('newMessage', (message) => {
    addBall(message, true);
});

socket.on('disconnect', () => {
    showStatus('연결 끊김', 'error');
});

async function loadInitialMessages() {
    try {
        const response = await fetch('/api/messages');
        if (!response.ok) {
            throw new Error('Failed to load messages');
        }
        const messages = await response.json();
        
        // Clear existing balls
        balls.forEach(ball => ball.remove());
        balls = [];
        
        // Add all messages with random positions
        messages.forEach(msg => {
            const x = Math.random() * containerWidth;
            const y = Math.random() * containerHeight;
            const ball = new Ball(msg.id, msg.content, x, y);
            balls.push(ball);
        });
    } catch (error) {
        console.error('Error loading messages:', error);
        showStatus('메시지 로드 실패', 'error');
    }
}

function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
    status.style.display = 'block';
}
