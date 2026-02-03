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
        document.documentElement.style.setProperty('background-color', '#ffd7e2', 'important');
        document.documentElement.style.setProperty('color', '#333333', 'important');
    }
    if (document.body) {
        document.body.style.setProperty('background', 'linear-gradient(135deg, #ffd7e2 0%, #ffe8c7 35%, #e0f2ff 75%, #e3dcff 100%)', 'important');
        document.body.style.setProperty('background-color', '#ffd7e2', 'important');
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

const ballContainer = document.getElementById('ballContainer');
const status = document.getElementById('status');

let socket = null;
let balls = [];
let animationId = null;
let containerWidth = 0;
let containerHeight = 0;

const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// world tuning (말랑/따뜻/끈적)
const WORLD = {
    maxDt: 0.05,
    noiseAmp: 28,          // px/s^2
    noiseSpeed: 0.65,      // phase speed
    dragPerSecond: 0.22,   // higher = more sticky
    boundaryK: 34,         // boundary spring
    boundaryD: 9.5,        // boundary damping
    collideK: 48,          // collision spring
    collideD: 8.5,         // collision damping
    maxSpeed: 240,         // px/s
};

// Ball class
class Ball {
    constructor(id, content, x, y) {
        this.id = id;
        this.content = content;
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 40;
        this.vy = (Math.random() - 0.5) * 40;
        this.radius = Math.max(40, Math.min(100, content.length * 3 + 40));
        this.element = null;
        
        // Generate pastel color
        this.hue = Math.random() * 360;
        this.saturation = 40 + Math.random() * 20; // 40-60%
        this.lightness = 70 + Math.random() * 15; // 70-85%
        
        // movement phase (continuous, but very soft)
        this.phase = Math.random() * Math.PI * 2;
        this.phase2 = Math.random() * Math.PI * 2;
        this.phaseSpeed = 0.45 + Math.random() * 0.35;

        // squash & stretch (slime)
        this.sx = 1;
        this.sy = 1;
        this.svx = 0;
        this.svy = 0;
        this.squishX = 0;
        this.squishY = 0;
        this.rot = (Math.random() - 0.5) * 6;
        this.rotV = (Math.random() - 0.5) * 18;

        // born pop timing
        this.bornAt = performance.now();
        
        this.createElement();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'message-ball';
        this.element.textContent = this.content;
        this.element.style.width = (this.radius * 2) + 'px';
        this.element.style.height = (this.radius * 2) + 'px';
        this.element.style.willChange = 'transform';
        
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

    update(dt, now) {
        // sticky drag (frame-rate independent)
        const drag = Math.exp(-WORLD.dragPerSecond * dt);
        this.vx *= drag;
        this.vy *= drag;

        // gentle procedural drift (continuous, low frequency)
        if (!prefersReducedMotion) {
            this.phase += this.phaseSpeed * dt * WORLD.noiseSpeed;
            this.phase2 += (this.phaseSpeed * 0.83) * dt * WORLD.noiseSpeed;
            const ax = (Math.sin(this.phase) + Math.sin(this.phase2 * 0.9)) * 0.5 * WORLD.noiseAmp;
            const ay = (Math.cos(this.phase2) + Math.cos(this.phase * 0.85)) * 0.5 * WORLD.noiseAmp;
            this.vx += ax * dt;
            this.vy += ay * dt;
        }

        // clamp max speed (avoid spikes)
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > WORLD.maxSpeed) {
            const k = WORLD.maxSpeed / (sp || 1);
            this.vx *= k;
            this.vy *= k;
        }

        // integrate
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // soft boundary (spring, not bounce)
        this.applyBoundary(dt);

        // subtle breathing (cheap, 1D)
        const t = now * 0.001;
        const breath = prefersReducedMotion ? 0 : (Math.sin(t * 0.9 + this.phase2) * 0.02);
        const targetSx = 1 + breath;
        const targetSy = 1 - breath;

        // squish targets blend
        const sxTarget = targetSx + this.squishX;
        const syTarget = targetSy + this.squishY;

        // springy scale back (slime)
        const sk = 28;
        const sd = 9;
        this.svx += (sxTarget - this.sx) * sk * dt;
        this.svx *= Math.exp(-sd * dt);
        this.sx += this.svx * dt;

        this.svy += (syTarget - this.sy) * sk * dt;
        this.svy *= Math.exp(-sd * dt);
        this.sy += this.svy * dt;

        // decay squish
        this.squishX *= Math.exp(-7.5 * dt);
        this.squishY *= Math.exp(-7.5 * dt);

        // tiny rotation drift
        this.rotV *= Math.exp(-2.2 * dt);
        this.rot += this.rotV * dt;
        this.rot = clamp(this.rot, -10, 10);

        // update DOM (transform only)
        if (this.element) {
            const tx = (this.x - this.radius);
            const ty = (this.y - this.radius);
            this.element.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${this.rot}deg) scale(${this.sx}, ${this.sy})`;
        }
    }

    applyBoundary(dt) {
        if (containerWidth <= 0 || containerHeight <= 0) return;

        const left = this.radius;
        const right = containerWidth - this.radius;
        const top = this.radius;
        const bottom = containerHeight - this.radius;

        let fx = 0, fy = 0;
        let dx = 0, dy = 0;

        if (this.x < left) dx = (left - this.x);
        else if (this.x > right) dx = (right - this.x);

        if (this.y < top) dy = (top - this.y);
        else if (this.y > bottom) dy = (bottom - this.y);

        // spring towards inside
        fx += dx * WORLD.boundaryK - this.vx * WORLD.boundaryD * (dx !== 0 ? 1 : 0);
        fy += dy * WORLD.boundaryK - this.vy * WORLD.boundaryD * (dy !== 0 ? 1 : 0);

        this.vx += fx * dt;
        this.vy += fy * dt;

        // keep inside with a tiny margin
        this.x = clamp(this.x, left - 0.25, right + 0.25);
        this.y = clamp(this.y, top - 0.25, bottom + 0.25);
    }

    checkCollision(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dist = Math.hypot(dx, dy);
        const minDist = this.radius + other.radius;

        if (dist <= 0 || dist >= minDist) return;

        const nx = dx / dist;
        const ny = dy / dist;
        const penetration = (minDist - dist);

        // positional correction (soft)
        const push = penetration * 0.52;
        this.x -= nx * push;
        this.y -= ny * push;
        other.x += nx * push;
        other.y += ny * push;

        // relative velocity along normal
        const rvx = other.vx - this.vx;
        const rvy = other.vy - this.vy;
        const relN = rvx * nx + rvy * ny;

        // spring-damper impulse (no hard bounce)
        const k = WORLD.collideK;
        const d = WORLD.collideD;
        const impulse = (penetration * k - relN * d);

        const jx = nx * impulse;
        const jy = ny * impulse;

        this.vx -= jx;
        this.vy -= jy;
        other.vx += jx;
        other.vy += jy;

        // squish oriented to contact direction (slime)
        const s = clamp(penetration / (Math.min(this.radius, other.radius) * 0.9), 0, 0.35);

        // compress along normal, expand along tangent
        this.squishX += (-nx * nx + 0.5) * s * 0.55;
        this.squishY += (-ny * ny + 0.5) * s * 0.55;
        other.squishX += (-nx * nx + 0.5) * s * 0.55;
        other.squishY += (-ny * ny + 0.5) * s * 0.55;

        // tiny rotation kick (gooey)
        const twist = (rvx * -ny + rvy * nx);
        this.rotV += clamp(twist * 0.015, -28, 28);
        other.rotV -= clamp(twist * 0.015, -28, 28);
    }

    applyForce(fx, fy) {
        this.vx += fx;
        this.vy += fy;
    }

    squish() {}

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
let lastNow = performance.now();
let statusHideAt = 0;

function animate(now) {
    const dt = clamp((now - lastNow) / 1000, 0.001, WORLD.maxDt);
    lastNow = now;

    // update all balls
    for (let i = 0; i < balls.length; i++) {
        balls[i].update(dt, now);
    }

    // collisions (O(n^2), but n is small in this use-case)
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            balls[i].checkCollision(balls[j]);
        }
    }

    if (statusHideAt && now >= statusHideAt) {
        statusHideAt = 0;
        status.style.display = 'none';
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
        ball.vx = (Math.random() - 0.5) * 180;
        ball.vy = (Math.random() - 0.5) * 180;
        
        // Push away existing balls
        balls.forEach(existingBall => {
            const dx = existingBall.x - centerX;
            const dy = existingBall.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 200 && distance > 0) {
                const force = 140 / Math.max(60, distance);
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
    statusHideAt = performance.now() + 2000;
    await loadInitialMessages();
    if (animationId === null) {
        lastNow = performance.now();
        animate(lastNow);
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
