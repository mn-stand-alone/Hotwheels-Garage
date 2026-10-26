(function () {
  const fx = createFX(document.getElementById('fx'));
  const stage = document.getElementById('stage');
  const multi = document.getElementById('multi');
  const btnOne = document.getElementById('drawOne');
  const btnAll = document.getElementById('drawAll');
  const btnAgain = document.getElementById('again');
  const toGarage = document.getElementById('toGarage');
  const hint = document.getElementById('hint');
  const RCOLORS = {
    common: ['#ffffff', '#aeb4bf'],
    rare: ['#bfe3ff', '#36a3ff', '#ffffff'],
    epic: ['#e9c8ff', '#b75cff', '#ff5ad1', '#ffffff'],
    legend: ['#fff6c0', '#ffc619', '#ff6a00', '#ffffff'],
  };
  const ORDER = ['common', 'rare', 'epic', 'legend'];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let busy = false;

  function setRarity(el, r) {
    ORDER.forEach((k) => el.classList.remove('r-' + k));
    el.classList.add('r-' + r);
  }

  function center(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  function refresh() {
    refreshNavStats();
    const left = Store.remaining();
    document.getElementById('fuel').innerHTML = Array.from({ length: Store.DAILY_LIMIT }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
    document.getElementById('allN').textContent = Math.max(left, 1);
    const cyc = Store.cycleInfo();
    document.getElementById('cycle').innerHTML =
      `<span class="cycle-label">本轮保底 <b>${cyc.pos}</b>/${Store.CYCLE}</span>` +
      ORDER.slice().reverse().map((r) => `<span class="cycle-tier r-${r}"><i class="tag">${Store.RARITY[r].name}</i>还剩 <b>${cyc.left[r]}</b></span>`).join('');
    const poolLeft = Store.pool().length;
    const disabled = busy || left === 0 || poolLeft === 0;
    btnOne.disabled = disabled;
    btnAll.disabled = disabled || left < 2 || poolLeft < 2;
    if (poolLeft === 0) {
      hint.innerHTML = '🏆 恭喜！车库已集齐全部 <b>' + Store.cards.length + '</b> 辆小车！';
    } else if (left === 0) {
      hint.innerHTML = `今天的油量用完啦，距离加满还有 <b id="cd">${fmtCountdown(Store.msToMidnight())}</b>`;
    } else {
      hint.innerHTML = `车库里还有 <b>${poolLeft}</b> 辆车等你开回家`;
    }
  }
  setInterval(() => {
    const cd = document.getElementById('cd');
    if (cd) {
      const ms = Store.msToMidnight();
      cd.textContent = fmtCountdown(ms);
      if (ms < 1000) setTimeout(refresh, 1200);
    }
  }, 1000);

  function showButtons(mode) {
    const idle = mode === 'idle';
    btnOne.hidden = !idle;
    btnAll.hidden = !idle;
    btnAgain.hidden = idle;
    toGarage.hidden = idle;
  }

  function resetStage() {
    stage.className = 'stage';
    multi.hidden = true;
    document.getElementById('multiGrid').innerHTML = '';
  }

  async function openBay(rarity) {
    window.GameAudio?.sfx('charge');
    resetStage();
    setRarity(stage, rarity);
    await wait(30);
    stage.classList.add('charging');
    const heavy = rarity === 'epic' || rarity === 'legend';
    await wait(heavy ? 1500 : 900);
    stage.classList.remove('charging');
    stage.classList.add('open');
    const [x, y] = center(stage.querySelector('.bay'));
    fx.ring(x, y, heavy ? 'rgba(255,198,25,' : 'rgba(255,255,255,', 260, 8);
    fx.sparks(x, y - 60, heavy ? 70 : 30, RCOLORS[rarity], heavy ? 14 : 9);
    await wait(900);
  }

  function burst(rarity, x, y) {
    window.GameAudio?.sfx('reveal',rarity);
    fx.sparks(x, y, rarity === 'legend' ? 140 : rarity === 'epic' ? 90 : 40, RCOLORS[rarity], rarity === 'common' ? 8 : 15);
    fx.ring(x, y, 'rgba(255,255,255,', 300, 6);
    if (rarity === 'legend') {
      fx.confetti(x, y, 160, RCOLORS.legend.concat(['#e5202b']));
      setTimeout(() => fx.ring(x, y, 'rgba(255,198,25,', 520, 12), 180);
    } else if (rarity === 'epic') {
      fx.confetti(x, y, 70, RCOLORS.epic);
    }
  }

  async function drawOne() {
    if (busy) return;
    const res = Store.draw();
    if (res.error) return refresh();
    busy = true;
    refresh();
    const c = res.card;
    document.getElementById('frontImg').src = c.img;
    document.getElementById('rTag').textContent = `${Store.RARITY[c.rarity].name} ${Store.RARITY[c.rarity].en}`;
    document.getElementById('rName').textContent = cardTitle(c);
    document.getElementById('rMeta').textContent = [c.batch, c.code, [c.series, c.seriesNo].filter(Boolean).join(' '), c.maker].filter(Boolean).join(' · ');
    btnOne.hidden = btnAll.hidden = true;

    await openBay(c.rarity);
    stage.classList.add('flipped');
    await wait(350);
    const [x, y] = center(stage.querySelector('.bay'));
    burst(c.rarity, x, y);
    await wait(900);
    busy = false;
    showButtons('done');
    refresh();
  }

  async function drawMany() {
    if (busy) return;
    const n = Math.min(Store.remaining(), Store.pool().length);
    if (n < 2) return;
    busy = true;
    const got = [];
    for (let i = 0; i < n; i++) {
      const res = Store.draw();
      if (res.card) got.push(res.card);
    }
    refresh();
    btnOne.hidden = btnAll.hidden = true;
    const best = got.reduce((b, c) => (ORDER.indexOf(c.rarity) > ORDER.indexOf(b) ? c.rarity : b), 'common');

    // 先开门预告最高稀有度，再展开网格逐张翻牌
    document.getElementById('frontImg').removeAttribute('src');
    await openBay(best);
    stage.classList.add('hide');
    multi.hidden = false;
    document.getElementById('multiCount').textContent = got.length;
    const grid = document.getElementById('multiGrid');
    grid.innerHTML = got.map((c, i) => `
      <div class="mcard r-${c.rarity}" data-i="${i}">
        <div class="inner">
          <div class="face back"><div class="card-back"><span class="stripe"></span><span class="q">?</span></div></div>
          <div class="face front"><img src="${c.thumb}" alt=""></div>
        </div>
        <div class="cap"><span class="tag">${Store.RARITY[c.rarity].name}</span>${escapeHTML(cardTitle(c))}</div>
      </div>`).join('');
    const els = [...grid.children];
    for (const el of els) { el.classList.add('in'); await wait(70); }
    await wait(400);
    for (const el of els) {
      const c = got[+el.dataset.i];
      el.classList.add('flipped');
      const [x, y] = center(el);
      setTimeout(() => burst(c.rarity, x, y), 250);
      await wait(c.rarity === 'legend' ? 900 : c.rarity === 'epic' ? 650 : 280);
    }
    grid.addEventListener('click', (e) => {
      const el = e.target.closest('.mcard');
      if (el) openDetail(got[+el.dataset.i]);
    });
    busy = false;
    showButtons('done');
    refresh();
  }

  btnOne.addEventListener('click', drawOne);
  btnAll.addEventListener('click', drawMany);
  btnAgain.addEventListener('click', () => {
    resetStage();
    showButtons('idle');
    refresh();
  });
  stage.querySelector('.bay').addEventListener('click', () => {
    if (stage.classList.contains('flipped') && !busy) {
      const src = document.getElementById('frontImg').getAttribute('src');
      const c = Store.cards.find((k) => k.img === src);
      if (c) openDetail(c);
    } else if (!busy && !btnOne.disabled && !btnOne.hidden) {
      drawOne();
    }
  });

  showButtons('idle');
  refresh();
})();
