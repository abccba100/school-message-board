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

// 페이지 로드 시 환영 효과 (약간 지연 후 실행)
window.addEventListener('load', () => {
    setTimeout(() => {
        if (window.launchEffect && window.launchEffect.fire) {
            console.log('🎉 Welcome effect triggered!');
            window.launchEffect.fire();
            
            // 연쇄 폭발 (환영식)
            setTimeout(() => {
                if (window.launchEffect && window.launchEffect.createArrivalBurst) {
                    window.launchEffect.createArrivalBurst(
                        window.innerWidth / 2,
                        window.innerHeight / 2
                    );
                }
            }, 500);
            
            // 추가 폭발
            setTimeout(() => {
                if (window.launchEffect && window.launchEffect.fire) {
                    window.launchEffect.fire();
                }
            }, 1000);
        }
    }, 800);
});

const ballContainer = document.getElementById('ballContainer');
const status = document.getElementById('status');

let socket = null;
let balls = [];
let animationId = null;
let containerWidth = 0;
let containerHeight = 0;

const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// world tuning (말랑/따뜻/끈적) - 강화된 물리 효과
const WORLD = {
    maxDt: 0.05,
    noiseAmp: 22,             // px/s^2
    noiseSpeed: 0.62,         // phase speed
    dragPerSecond: 0.34,      // higher = more sticky
    boundaryK: 56,            // boundary spring (젤리벽) - 증가
    boundaryD: 16.5,          // boundary damping - 증가
    boundaryFriction: 0.75,   // tangential damping on wall contact - 감소 (더 끈적)
    boundaryZone: 32,         // soft zone thickness (px) - 증가
    collideK: 72,             // collision spring - 증가
    collideD: 18.0,           // collision damping - 증가
    collideFriction: 0.85,    // tangential damping on contact - 감소 (더 끈적)
    separateRate: 0.15,       // slow positional separation factor
    maxSepCorrection: 1.5,    // max px per frame of positional correction
    maxSpeed: 190,            // px/s
    maxContactSquish: 0.42,   // clamp for squish magnitude - 증가
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
        this.mass = clamp((this.radius / 55) ** 2, 0.75, 2.2);
        this.element = null;
        
        // Generate pastel color
        this.hue = Math.random() * 360;
        this.saturation = 40 + Math.random() * 20; // 40-60%
        this.lightness = 70 + Math.random() * 15; // 70-85%
        
        // movement phase (continuous, but very soft)
        this.phase = Math.random() * Math.PI * 2;
        this.phase2 = Math.random() * Math.PI * 2;
        this.phaseSpeed = 0.45 + Math.random() * 0.35;

        // squash & stretch (slime) - 향상된 값
        this.sx = 1;
        this.sy = 1;
        this.svx = 0;
        this.svy = 0;
        this.squishX = 0;
        this.squishY = 0;
        this.rot = (Math.random() - 0.5) * 6;
        this.rotV = (Math.random() - 0.5) * 18;
        this.pulseP = Math.random() * Math.PI * 2;

        // born pop timing
        this.bornAt = performance.now();
        
        // 발사 애니메이션용 (속도 기반 직선 비행)
        this.isLaunching = false;
        this.launchTimer = 0;
        this.launchDuration = 0;
        this.launchStartX = x;
        this.launchStartY = y;
        
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
        // 발사 애니메이션 처리 (속도 기반 직선 비행 - 대포처럼)
        if (this.isLaunching) {
            this.launchTimer += dt;
            const progress = Math.min(1.0, this.launchTimer / this.launchDuration);
            
            // 직선으로 날아감 (속도 기반, 자연스러운 감속)
            this.x += this.vx;
            this.y += this.vy;
            
            // 부드러운 감속 (매 프레임 속도 줄임)
            const decel = 0.945;
            this.vx *= decel;
            this.vy *= decel;
            
            this.rot += this.rotV * dt;
            
            // 비행 중 스쿼시 (진행방향으로 늘어남)
            const speed = Math.hypot(this.vx, this.vy);
            const stretchAmount = clamp(speed / 18, 0, 0.55);
            this.squishX = stretchAmount;
            this.squishY = -stretchAmount * 0.45;
            
            // 비행 중 파티클 트레일 이벤트 발생
            if (window.launchEffect && window.launchEffect.emitTrail) {
                window.launchEffect.emitTrail(this.x, this.y, this.vx * 60, this.vy * 60, this.hue, progress);
            }
            
            // 비행 종료 (속도가 충분히 줄었거나 시간 초과)
            if (speed < 0.8 || progress >= 1.0) {
                this.isLaunching = false;
                this.vx = (Math.random() - 0.5) * 25;
                this.vy = (Math.random() - 0.5) * 25;
                // 도착 폭발 이펙트!
                if (window.launchEffect && window.launchEffect.createArrivalBurst) {
                    window.launchEffect.createArrivalBurst(this.x, this.y);
                }
                // 도착 스쿼시 (찌그러짐)
                this.squishX = -0.28;
                this.squishY = 0.20;
            }
            
            // update DOM during launch
            if (this.element) {
                const tx = (this.x - this.radius);
                const ty = (this.y - this.radius);
                this.element.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${this.rot}deg) scale(${1 + this.squishX}, ${1 + this.squishY})`;
            }
            return; // 발사 중에는 일반 물리 스킵
        }
        
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
        const breath = prefersReducedMotion ? 0 : (Math.sin(t * 0.9 + this.phase2) * 0.025);
        const targetSx = 1 + breath;
        const targetSy = 1 - breath;

        // micro pulse per ball (very subtle, different phase)
        let pulse = 0;
        if (!prefersReducedMotion) {
            this.pulseP += dt * (0.6 + (this.phaseSpeed * 0.35));
            pulse = Math.sin(this.pulseP) * 0.015;
        }

        // squish targets blend
        const sxTarget = (targetSx + pulse) + this.squishX;
        const syTarget = (targetSy - pulse) + this.squishY;

        // springy scale back (slime) - 더 강한 말랑거림
        const sk = 32;
        const sd = 13;
        this.svx += (sxTarget - this.sx) * sk * dt;
        this.svx *= Math.exp(-sd * dt);
        this.sx += this.svx * dt;

        this.svy += (syTarget - this.sy) * sk * dt;
        this.svy *= Math.exp(-sd * dt);
        this.sy += this.svy * dt;

        // decay squish - 더 천천히 사라짐
        this.squishX *= Math.exp(-7.2 * dt);
        this.squishY *= Math.exp(-7.2 * dt);

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

        const zone = WORLD.boundaryZone;
        let dx = 0, dy = 0;
        let nx = 0, ny = 0;

        if (this.x < left + zone) {
            dx = (left + zone) - this.x;
            nx = 1;
        } else if (this.x > right - zone) {
            dx = this.x - (right - zone);
            nx = -1;
        }

        if (this.y < top + zone) {
            dy = (top + zone) - this.y;
            ny = 1;
        } else if (this.y > bottom - zone) {
            dy = this.y - (bottom - zone);
            ny = -1;
        }

        if (dx > 0) {
            const depth = dx;
            const nSign = nx;
            const vN = this.vx * nSign;
            const fN = (depth * WORLD.boundaryK - vN * WORLD.boundaryD);
            this.vx += (fN * nSign) * (dt / this.mass);

            // wall tangential friction (y) - 더 끈적한 효과
            this.vy *= Math.exp(-WORLD.boundaryFriction * dt * clamp(depth / zone, 0, 1) * 1.3);

            // squash oriented to wall - 더 큰 변형
            const s = clamp((depth / zone) * 0.28, 0, WORLD.maxContactSquish);
            this.squishX += (Math.abs(nSign) * -0.22) * s;
            this.squishY += (0.15) * s;
            this.rotV += clamp(this.vy * 0.018, -20, 20);
        }

        if (dy > 0) {
            const depth = dy;
            const nSign = ny;
            const vN = this.vy * nSign;
            const fN = (depth * WORLD.boundaryK - vN * WORLD.boundaryD);
            this.vy += (fN * nSign) * (dt / this.mass);

            // wall tangential friction (x) - 더 끈적한 효과
            this.vx *= Math.exp(-WORLD.boundaryFriction * dt * clamp(depth / zone, 0, 1) * 1.3);

            // squash oriented to wall - 더 큰 변형
            const s = clamp((depth / zone) * 0.28, 0, WORLD.maxContactSquish);
            this.squishY += (Math.abs(nSign) * -0.22) * s;
            this.squishX += (0.15) * s;
            this.rotV += clamp(this.vx * 0.018, -20, 20);
        }

        // keep inside with a tiny margin (avoid runaway)
        this.x = clamp(this.x, left - 1.0, right + 1.0);
        this.y = clamp(this.y, top - 1.0, bottom + 1.0);
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

        // relative velocity along normal
        const rvx = other.vx - this.vx;
        const rvy = other.vy - this.vy;
        const relN = rvx * nx + rvy * ny;

        // slow positional separation (avoid one-frame big shove)
        const corr = clamp(penetration * WORLD.separateRate, 0, WORLD.maxSepCorrection);
        if (corr > 0) {
            const invMassA = 1 / this.mass;
            const invMassB = 1 / other.mass;
            const invSum = invMassA + invMassB;
            const aShare = invMassA / invSum;
            const bShare = invMassB / invSum;
            this.x -= nx * corr * aShare;
            this.y -= ny * corr * aShare;
            other.x += nx * corr * bShare;
            other.y += ny * corr * bShare;
        }

        // spring-damper "force" integrated over dt (no hard bounce)
        const k = WORLD.collideK;
        const d = WORLD.collideD;
        const forceN = (penetration * k - relN * d);
        const ax = nx * forceN;
        const ay = ny * forceN;

        this.vx -= (ax * (1 / this.mass)) * (1 / 60);
        this.vy -= (ay * (1 / this.mass)) * (1 / 60);
        other.vx += (ax * (1 / other.mass)) * (1 / 60);
        other.vy += (ay * (1 / other.mass)) * (1 / 60);

        // tangential friction (sticky contact) - 더 강함
        const tx = -ny;
        const ty = nx;
        const relT = rvx * tx + rvy * ty;
        const fr = WORLD.collideFriction;
        const tDamp = relT * fr * 1.2;
        const ftx = tx * tDamp;
        const fty = ty * tDamp;
        this.vx += (ftx * (1 / this.mass)) * (1 / 60);
        this.vy += (fty * (1 / this.mass)) * (1 / 60);
        other.vx -= (ftx * (1 / other.mass)) * (1 / 60);
        other.vy -= (fty * (1 / other.mass)) * (1 / 60);

        // squish oriented to contact direction (slime) - 더 큼
        const softness = Math.min(this.radius, other.radius) * 0.9;
        const s = clamp(penetration / (softness || 1), 0, WORLD.maxContactSquish);
        const nxx = nx * nx;
        const nyy = ny * ny;
        const sA = s * (other.mass / (this.mass + other.mass));
        const sB = s * (this.mass / (this.mass + other.mass));

        // compress along normal, expand along tangent (axis-oriented) - 더 큼
        this.squishX += (0.18 - nxx) * sA * 0.85;
        this.squishY += (0.18 - nyy) * sA * 0.85;
        other.squishX += (0.18 - nxx) * sB * 0.85;
        other.squishY += (0.18 - nyy) * sB * 0.85;

        // tiny rotation kick (gooey) - 더 강함
        const twist = (rvx * -ny + rvy * nx);
        this.rotV += clamp(twist * 0.016, -25, 25);
        other.rotV -= clamp(twist * 0.016, -25, 25);
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
let aliveStart = performance.now();
let pointerX = 0;
let pointerY = 0;
let pointerActive = false;
const bgCanvas = document.getElementById('bgCanvas');

window.addEventListener('pointermove', (e) => {
    pointerActive = true;
    pointerX = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    pointerY = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
}, { passive: true });

window.addEventListener('pointerleave', () => {
    pointerActive = false;
}, { passive: true });

function animate(now) {
    const dt = clamp((now - lastNow) / 1000, 0.001, WORLD.maxDt);
    lastNow = now;

    // page alive (very subtle)
    if (!prefersReducedMotion) {
        const t = (now - aliveStart) * 0.001;
        const ax = Math.sin(t * 0.33) * 10 + Math.sin(t * 0.17 + 1.2) * 6;
        const ay = Math.cos(t * 0.29) * 8 + Math.sin(t * 0.14 + 2.1) * 5;
        const px = pointerActive ? pointerX * 14 : 0;
        const py = pointerActive ? pointerY * 12 : 0;

        document.documentElement.style.setProperty('--alive-x', (ax + px).toFixed(2) + 'px');
        document.documentElement.style.setProperty('--alive-y', (ay + py).toFixed(2) + 'px');
        document.documentElement.style.setProperty('--alive-s', (1 + Math.sin(t * 0.22) * 0.006).toFixed(4));

        if (bgCanvas) {
            const bx = (ax * 0.35 + px * 0.5);
            const by = (ay * 0.35 + py * 0.5);
            bgCanvas.style.setProperty('--bgx', bx.toFixed(2) + 'px');
            bgCanvas.style.setProperty('--bgy', by.toFixed(2) + 'px');
        }
    } else {
        document.documentElement.style.setProperty('--alive-x', '0px');
        document.documentElement.style.setProperty('--alive-y', '0px');
        document.documentElement.style.setProperty('--alive-s', '1');
    }

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

// Add new ball - 왼쪽 아래에서 중앙으로 비행!
function addBall(message, isNew = false) {
    // 발사 지점 (왼쪽 아래 끝)
    const launchX = 80;
    const launchY = containerHeight - 80;
    
    const ball = new Ball(message.id, message.content, launchX, launchY);
    
    if (isNew) {
        // 도착 지점 (화면 중앙 근처, 약간의 랜덤)
        const targetX = containerWidth * 0.5 + (Math.random() - 0.5) * containerWidth * 0.25;
        const targetY = containerHeight * 0.5 + (Math.random() - 0.5) * containerHeight * 0.18;
        
        // 발사 방향 계산 (왼쪽 아래 → 중앙 방향)
        const dx = targetX - launchX;
        const dy = targetY - launchY;
        const angle = Math.atan2(dy, dx);
        
        // 강한 초기 속도 (직선으로 쏘듯이)
        const speed = 24 + Math.random() * 8;
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        
        // 발사 모드 ON
        ball.isLaunching = true;
        ball.launchTimer = 0;
        ball.launchDuration = 2.2; // 최대 2.2초 후 자동 종료
        
        // 발사 방향으로 회전 킥
        ball.rotV = (Math.random() - 0.5) * 55;
        
        // Push away existing balls near target (도착지 충격파 효과)
        balls.forEach(existingBall => {
            const dx = existingBall.x - targetX;
            const dy = existingBall.y - targetY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 380 && distance > 0) {
                const force = 120 / Math.max(140, distance);
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                existingBall.applyForce(fx, fy);
                existingBall.squishX += clamp((dx / distance) * 0.18, -0.18, 0.18);
                existingBall.squishY += clamp((dy / distance) * 0.18, -0.18, 0.18);
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
const io = window.io; // Declare the io variable before using it
socket = io();

socket.on('newMessage', (message) => {
    console.log('📨 New message received:', message.content);
    
    // 🎉 발사 효과! (공이 나올 때 자동으로 - 여러 번)
    if (window.launchEffect && window.launchEffect.fire) {
        console.log('✨ Launch effect triggered!');
        window.launchEffect.fire();
        
        // 약간의 딜레이 후 추가 폭발
        setTimeout(() => {
            if (window.launchEffect && window.launchEffect.fire) {
                window.launchEffect.fire();
            }
        }, 120);
    }
    
    // 동시에 메시지 공 추가 (발사 지점에서 튀어나옴)
    addBall(message, true);
    
    // 도착 효과 (공이 도착할 때쯤)
    setTimeout(() => {
        if (window.launchEffect && window.launchEffect.createArrivalBurst) {
            const targetX = containerWidth * 0.5 + (Math.random() - 0.5) * containerWidth * 0.25;
            const targetY = containerHeight * 0.5 + (Math.random() - 0.5) * containerHeight * 0.18;
            window.launchEffect.createArrivalBurst(targetX, targetY);
        }
    }, 2200);
});

socket.on('connect_error', (error) => {
    showStatus('연결 실패', 'error');
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

// Start animation loop when page is ready
document.addEventListener('DOMContentLoaded', () => {
    loadInitialMessages();
    animate(performance.now());
});