(function () {
  const intro = document.getElementById('intro');
  const car = document.getElementById('car');
  const titleEl = document.getElementById('title');
  const subEl = document.getElementById('sub');
  const fx = createFX(document.getElementById('fx'));

  const TITLE = '犇犇的车库';
  const SUB = "BENBEN'S GARAGE · HOT WHEELS COLLECTION";
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  // 统计
  document.getElementById('stRemain').textContent = Store.remaining();
  document.getElementById('stOwned').textContent = Store.ownedCount();
  document.getElementById('stTotal').textContent = Store.cards.length;

  // 标题
  titleEl.innerHTML = [...TITLE].map((ch, i) => `<span class="ch${ch === '犇' ? ' big' : ''}" style="--i:${i}">${ch}</span>`).join('') +
    `<span class="sweep" aria-hidden="true">${TITLE}</span>`;
  titleEl.setAttribute('aria-label', TITLE);

  // 漂浮卡牌：已拥有显示缩略图，未拥有显示卡背
  function buildFloaters() {
    const box = document.getElementById('floaters');
    const pick = [...Store.cards].sort(() => Math.random() - .5).slice(0, 26);
    box.innerHTML = pick.map((c, k) => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 70;
      const x = Math.cos(ang) * dist * 5.2;
      const y = Math.sin(ang) * dist * 2.6 - 40;
      const owned = Store.isOwned(c.id);
      const inner = owned
        ? `<img src="${c.thumb}" alt="" loading="lazy">`
        : `<div class="card-back"><span class="stripe"></span><span class="q">?</span></div>`;
      return `<div class="floater${owned ? '' : ' locked'}" style="--k:${k};--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--s:${(.7 + Math.random() * .6).toFixed(2)};--r:${(Math.random() * 30 - 15).toFixed(0)}deg;--o:${owned ? 1 : .75}">${inner}</div>`;
    }).join('');
  }

  function stage(name) { intro.classList.add(name); }
  function shake() { intro.classList.remove('shake'); void intro.offsetWidth; intro.classList.add('shake'); }

  function typeSub(speed) {
    subEl.textContent = '';
    let i = 0;
    const cursor = '<span class="cursor"></span>';
    (function step() {
      subEl.innerHTML = SUB.slice(0, i) + cursor;
      if (i++ < SUB.length) later(speed, step);
    })();
  }

  function slamEffects(step) {
    const chars = titleEl.querySelectorAll('.ch');
    chars.forEach((el, i) => {
      later(i * step + 330, () => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height * .85;
        fx.sparks(x, y, i < 2 ? 50 : 30);
        fx.ring(x, y, 'rgba(255,198,25,', r.width * 1.3, 8);
        if (i < 2) fx.ring(x, y - r.height * .4, 'rgba(229,32,43,', r.width * 1.8, 4);
        if (i === chars.length - 1) shake();
      });
    });
  }

  // 小车冲刺：rAF 控制位置并在尾部喷火
  function runCar(duration) {
    window.GameAudio?.sfx('intro');
    const start = performance.now();
    const vw = window.innerWidth;
    const carW = car.offsetWidth;
    const from = -carW * 1.3, to = vw + carW * .4;
    (function frame(now) {
      const k = Math.min(1, (now - start) / duration);
      const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = from + (to - from) * e;
      car.style.transform = `translate(${x}px, -50%) skewX(${-12 * Math.sin(k * Math.PI)}deg)`;
      const r = car.getBoundingClientRect();
      fx.flame(r.left + r.width * .04, r.top + r.height * .6, 7, -1);
      if (Math.random() < .5) fx.sparks(r.left + r.width * .25, r.bottom - 6, 3, ['#ffc619', '#fff'], 5);
      if (k < 1) requestAnimationFrame(frame);
      else car.style.transform = '';
    })(start);
  }

  function play(short) {
    timers.splice(0).forEach(clearTimeout);
    intro.className = 'intro';
    car.style.transform = '';
    subEl.textContent = '';
    buildFloaters();
    fx.embers(0);

    if (reduced) {
      intro.classList.add('instant', 'st-track', 'st-title', 'st-door', 'st-ready');
      subEl.textContent = SUB;
      Store.markIntroSeen();
      return;
    }

    const T = short
      ? { track: 0, car: -1, title: 150, step: 90, door: 900, sub: 700, ready: 1900 }
      : { lights: 0, track: 1150, car: 1350, title: 2350, step: 220, door: 4700, sub: 3600, ready: 6300 };

    titleEl.style.setProperty('--step', `${T.step / 1000}s`);
    if (!short) later(T.lights, () => stage('st-lights'));
    later(T.track, () => { stage('st-track'); fx.embers(3); if (!short) shake(); });
    if (T.car >= 0) later(T.car, () => runCar(1050));
    later(T.title, () => { stage('st-title'); slamEffects(T.step); });
    later(T.sub, () => typeSub(short ? 12 : 34));
    later(T.door, () => {
      stage('st-door');
      const g = document.querySelector('.garage').getBoundingClientRect();
      later(500, () => fx.sparks(g.left + g.width / 2, g.top + g.height * .5, 60, ['#fff6c0', '#ffc619', '#ff6a00', '#e5202b'], 14));
    });
    later(T.ready, () => { stage('st-ready'); Store.markIntroSeen(); });
  }

  function skip() {
    timers.splice(0).forEach(clearTimeout);
    car.style.transform = '';
    intro.className = 'intro instant st-track st-title st-door st-ready';
    subEl.textContent = SUB;
    fx.embers(3);
    Store.markIntroSeen();
    requestAnimationFrame(() => requestAnimationFrame(() => intro.classList.remove('instant')));
  }

  document.getElementById('skipBtn').addEventListener('click', skip);
  document.getElementById('replayBtn').addEventListener('click', () => play(false));
  document.getElementById('enterBtn').addEventListener('click', () => {
    const b = document.getElementById('enterBtn').getBoundingClientRect();
    fx.sparks(b.left + b.width / 2, b.top + b.height / 2, 80, undefined, 16);
    fx.ring(b.left + b.width / 2, b.top + b.height / 2, 'rgba(255,198,25,', 400, 10);
    shake();
    setTimeout(() => intro.classList.add('leaving'), 200);
    setTimeout(() => { location.href = 'home.html'; }, 850);
  });

  const start = () => play(new URLSearchParams(location.search).get('intro')==='full'?false:Store.introSeenToday());
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(start);
  } else start();
})();
