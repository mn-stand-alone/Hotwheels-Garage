(function () {
  const cards = Store.cards;
  const $ = (id) => document.getElementById(id);
  let owned = Store.state().owned;

  // 批次排序：年份 → 批次字母
  const batches = [...new Map(cards.map((c) => [c.batch, c])).values()]
    .sort((a, b) => (a.year - b.year) || a.caseLetter.localeCompare(b.caseLetter))
    .map((c) => c.batch);
  const series = [...new Set(cards.map((c) => c.series).filter(Boolean))].sort();
  const addOpts = (sel, list) => sel.insertAdjacentHTML('beforeend', list.map(([v, t]) => `<option value="${escapeHTML(v)}">${escapeHTML(t)}</option>`).join(''));
  addOpts($('fBatch'), batches.map((b) => [b, b]));
  addOpts($('fSeries'), series.map((s) => [s, s]));
  addOpts($('fRarity'), Object.entries(Store.RARITY).map(([k, r]) => [k, r.name]));

  refreshNavStats();
  const pct = cards.length ? (Store.ownedCount() / cards.length) * 100 : 0;
  requestAnimationFrame(() => ($('bar').style.width = pct + '%'));

  function matches(c, f) {
    if (f.batch && c.batch !== f.batch) return false;
    if (f.series && c.series !== f.series) return false;
    if (f.rarity && c.rarity !== f.rarity) return false;
    const own = !!owned[c.id];
    if (f.own === 'own' && !own) return false;
    if (f.own === 'favorite' && !Store.isFavorite(c.id)) return false;
    if (f.own === 'lock' && own) return false;
    if (f.q) {
      // 未入库的卡只允许按批次/编号搜索，避免剧透车名
      const hay = (own
        ? [c.nameZh, c.nameEn, c.cardName, c.code, c.series, c.maker, c.batch]
        : [c.batch, c.code]).join(' ').toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  }

  function slot(c) {
    if (owned[c.id]) {
      return `<div class="slot own r-${c.rarity}" data-id="${c.id}" id="c-${c.id}">
        <img src="${c.thumb}" alt="${escapeHTML(cardTitle(c))}" loading="lazy">
        ${c.rarity !== 'common' ? `<span class="tag rt">${Store.RARITY[c.rarity].name}</span>` : ''}
        <span class="nm">${escapeHTML(cardTitle(c))}</span>${favoriteButtonHTML(c.id)}
      </div>`;
    }
    return `<div class="slot lock" data-id="${c.id}" id="c-${c.id}">
      <div class="card-back"><span class="stripe"></span><span class="q">?</span></div>
      <span class="lb">${escapeHTML(c.batch)}</span>
    </div>`;
  }

  function render() {
    owned=Store.state().owned;refreshFavorites();
    const f = { q: $('q').value.trim().toLowerCase(), batch: $('fBatch').value, series: $('fSeries').value, rarity: $('fRarity').value, own: $('fOwn').value };
    const html = batches.map((b) => {
      const all = cards.filter((c) => c.batch === b);
      const shown = all.filter((c) => matches(c, f));
      if (!shown.length) return '';
      const got = all.filter((c) => owned[c.id]).length;
      return `<section class="batch">
        <div class="batch-head">
          <span class="badge">${escapeHTML(b)}</span>
          <span class="count">已收集 <b>${got}</b> / ${all.length}</span>
          <div class="progress mini"><i style="width:${(got / all.length) * 100}%"></i></div>
          ${got === all.length ? '<span class="done">🏆 本批集齐</span>' : ''}
        </div>
        <div class="grid">${shown.map(slot).join('')}</div>
      </section>`;
    }).join('');
    $('list').innerHTML = html || '<p class="empty">没有符合条件的小车</p>';
  }

  let tId;
  $('q').addEventListener('input', () => { clearTimeout(tId); tId = setTimeout(render, 150); });
  ['fBatch', 'fSeries', 'fRarity', 'fOwn'].forEach((id) => $(id).addEventListener('change', render));

  $('list').addEventListener('click', (e) => {
    if(e.target.closest('[data-favorite]'))return;
    const el = e.target.closest('.slot');
    if (!el) return;
    const c = Store.byId[el.dataset.id];
    if (owned[c.id]) openDetail(c);
    else toast(`🔒 这辆 ${c.batch} 的小车还没开进车库，去抽卡吧！`);
  });

  document.addEventListener('favoriteschange',()=>{if($('fOwn').value==='favorite')render();else refreshFavorites();});
  window.addEventListener('storage',e=>{if(e.key==='benben-garage-v1')render();});
  render();

  // 从首页“最近入库”跳转过来时定位并高亮
  const hash = location.hash.slice(1);
  if (hash && Store.byId[hash]) {
    const el = $('c-' + hash);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('flash');
    }
  }
})();
