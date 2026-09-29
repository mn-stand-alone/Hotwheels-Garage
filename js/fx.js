// 轻量粒子引擎：火焰、火花、冲击波、余烬、彩屑
function createFX(canvas) {
  const ctx = canvas.getContext('2d');
  const parts = [];
  let w = 0, h = 0, dpr = 1, running = true, embers = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const rand = (a, b) => a + Math.random() * (b - a);

  const api = {
    get width() { return w; },
    get height() { return h; },
    flame(x, y, n = 6, dir = -1) {
      for (let i = 0; i < n; i++) {
        parts.push({ t: 'flame', x: x + rand(-6, 6), y: y + rand(-10, 10), vx: dir * rand(1, 5), vy: rand(-1.6, .4), life: 0, max: rand(28, 55), size: rand(10, 26) });
      }
    },
    sparks(x, y, n = 30, colors = ['#fff6c0', '#ffc619', '#ff6a00'], speed = 9) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = rand(speed * .3, speed);
        parts.push({ t: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 0, max: rand(30, 60), size: rand(1.5, 3.5), color: colors[i % colors.length] });
      }
    },
    ring(x, y, color = 'rgba(255,198,25,', maxR = 160, width = 6) {
      parts.push({ t: 'ring', x, y, life: 0, max: 36, maxR, width, color });
    },
    confetti(x, y, n = 80, colors = ['#ffc619', '#e5202b', '#1f8bff', '#fff']) {
      for (let i = 0; i < n; i++) {
        const a = rand(-Math.PI, 0), s = rand(4, 14);
        parts.push({ t: 'conf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(70, 120), size: rand(5, 10), rot: rand(0, 6), vr: rand(-.3, .3), color: colors[i % colors.length] });
      }
    },
    embers(n) { embers = n; },
    stop() { running = false; },
  };

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < embers; i++) {
      if (Math.random() < .08) parts.push({ t: 'ember', x: rand(0, w), y: h + 10, vx: rand(-.4, .4), vy: rand(-2.2, -.8), life: 0, max: rand(120, 260), size: rand(1, 2.6) });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life++;
      const k = p.life / p.max;
      if (k >= 1) { parts.splice(i, 1); continue; }
      if (p.t === 'flame') {
        p.x += p.vx; p.y += p.vy; p.vy -= .05; p.vx *= .97;
        const r = p.size * (1 - k * .6);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        const hue = 50 - k * 50;
        g.addColorStop(0, `hsla(${hue + 10},100%,${80 - k * 30}%,${.9 * (1 - k)})`);
        g.addColorStop(.4, `hsla(${hue},100%,50%,${.55 * (1 - k)})`);
        g.addColorStop(1, 'hsla(0,100%,40%,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (p.t === 'spark') {
        const ox = p.x, oy = p.y;
        p.x += p.vx; p.y += p.vy; p.vy += .25; p.vx *= .98;
        ctx.strokeStyle = p.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.t === 'ring') {
        const e = 1 - Math.pow(1 - k, 3);
        ctx.strokeStyle = `${p.color}${1 - k})`; ctx.lineWidth = p.width * (1 - k) + .5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.maxR * e, 0, Math.PI * 2); ctx.stroke();
      } else if (p.t === 'ember') {
        p.x += p.vx + Math.sin(p.life / 20) * .3; p.y += p.vy;
        ctx.fillStyle = `rgba(255,${140 + 80 * (1 - k)},40,${Math.sin(k * Math.PI) * .8})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.t === 'conf') {
        ctx.globalCompositeOperation = 'source-over';
        p.x += p.vx; p.y += p.vy; p.vy += .22; p.vx *= .98; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return api;
}
