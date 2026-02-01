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
        ballContainer.appendChild(this.element);
    }

    update() {
        // Apply damping
        this.vx *= 0.99;
        this.vy *= 0.99;

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
        }
    }

    applyForce(fx, fy) {
        this.vx += fx;
        this.vy += fy;
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
