// cannon-effect.js
(() => {
    const canvas = document.getElementById('effectCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    let w = 0, h = 0;
    const particles = [];

    const CANNON = {
        x: 150,
        y: () => window.innerHeight - 100,
        angle: -45 * Math.PI / 180
    };

    function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * DPR;
        canvas.height = h * DPR;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function fire() {
        const ox = CANNON.x;
        const oy = CANNON.y();

        for (let i = 0; i < 80; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 150 + Math.random() * 300;
            particles.push({
                x: ox,
                y: oy,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: 1,
                r: 2 + Math.random() * 4
            });
        }
    }

    function animate() {
        ctx.clearRect(0, 0, w, h);

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            p.vy += 480 * 0.016;
            p.life -= 0.03;

            ctx.fillStyle = `rgba(255,180,220,${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();

            if (p.life <= 0) particles.splice(i, 1);
        }

        requestAnimationFrame(animate);
    }
    animate();

    window.cannonEffect = { fire, CANNON };
})();
