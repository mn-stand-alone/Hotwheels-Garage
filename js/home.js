(function () {
  const total = Store.cards.length;
  const owned = Store.ownedCount();
  document.querySelectorAll('[data-remain]').forEach((el) => (el.textContent = Store.remaining()));
  document.getElementById('owned').textContent = `${owned}/${total}`;
  const pct = total ? (owned / total) * 100 : 0;
  document.getElementById('pct').textContent = `${pct.toFixed(pct && pct < 10 ? 1 : 0)}%`;
  requestAnimationFrame(() => (document.getElementById('bar').style.width = `${pct}%`));

  // 展示位：优先已拥有的高稀有度卡，否则卡背
  const s = Store.state();
  const ownedCards = Store.cards.filter((c) => s.owned[c.id]);
  const order = { legend: 0, epic: 1, rare: 2, common: 3 };
  const pick = [...ownedCards].sort((a, b) => order[a.rarity] - order[b.rarity] || s.owned[b.id] - s.owned[a.id]).slice(0, 3);
  const show = document.getElementById('showcase');
  const pos = [[-110, -55, -10], [-50, -50, 0], [10, -45, 10]];
  show.innerHTML = [0, 1, 2].map((i) => {
    const c = pick[i];
    const [x, y, r] = pos[i];
    const inner = c ? `<img src="${c.thumb}" alt="${escapeHTML(cardTitle(c))}">` : `<div class="card-back"><span class="stripe"></span><span class="q">?</span></div>`;
    return `<div class="c ${c ? 'r-' + c.rarity : ''}" style="transform:translate(${x}%,${y}%) rotate(${r}deg);z-index:${i === 1 ? 3 : 1}">${inner}</div>`;
  }).join('');

  const recent = ownedCards.sort((a, b) => s.owned[b.id] - s.owned[a.id]).slice(0, 20);
  document.getElementById('recent').innerHTML = recent.length
    ? recent.map((c) => `<a class="r-${c.rarity}" href="garage.html#${c.id}" title="${escapeHTML(cardTitle(c))}"><img src="${c.thumb}" alt=""></a>`).join('')
    : '<p style="color:var(--muted);margin:0">车库还空着，快去抽第一辆车吧！</p>';

  const counts = {};
  Store.cards.forEach((c) => (counts[c.rarity] = (counts[c.rarity] || 0) + 1));
  const desc = { legend: '超级寻宝 / 寻宝 / 顶级名车', epic: '新模具 / 超跑与经典名车', rare: '真实授权车型', common: '常规主线' };
  document.getElementById('rar').innerHTML = Object.entries(Store.RARITY).map(([k, r]) =>
    `<div class="r-${k}"><b>${r.name} ${r.en}</b><small>${desc[k]}</small><small>卡池 ${counts[k] || 0} 张 · 每 10 抽必出 ${r.per} 张</small></div>`).join('');

  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `犇犇的车库-进度-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const file = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    try {
      Store.importJSON(await file.files[0].text());
      alert('导入成功！');
      location.reload();
    } catch (e) {
      alert('导入失败：' + e.message);
    }
  });
})();
