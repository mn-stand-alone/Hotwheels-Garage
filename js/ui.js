// 通用界面：详情弹窗、提示、导航统计
function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2300);
}

function openDetail(c) {
  window.GameAudio?.sfx("detail");
  const r = Store.RARITY[c.rarity];
  const got = Store.state().owned[c.id];
  const rows = [
    ['批次', `${c.batch}${c.year ? `（${c.year} 年 ${c.caseLetter} 批）` : ''}`],
    ['编号', c.code],
    ['主线序号', c.mainlineNo],
    ['系列', [c.series, c.seriesNo].filter(Boolean).join(' · ')],
    ['车身颜色', c.color],
    ['特别标记', [c.sth && '超级寻宝 $TH', c.th && '寻宝 TH', c.newModel && '新模具'].filter(Boolean).join(' / ')],
    ['入库时间', got ? new Date(got).toLocaleString('zh-CN') : ''],
  ].filter(([, v]) => v);
  // 车型档案：始终展示，缺失字段以“—”占位
  const profile = [
    ['原型车厂商', c.maker],
    ['原型年份', c.carYear],
    ['国家/地区', c.country],
    ['风火轮首发', c.firstYear],
    ['设计师', c.designer],
  ];

  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div class="modal-box r-${c.rarity}" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="关闭">×</button>
      <img src="${c.img}" alt="${escapeHTML(cardTitle(c))}">
      <div class="detail">
        <span class="tag">${r.name} ${r.en}</span>
        <h2>${escapeHTML(cardTitle(c))}</h2>
        ${got?favoriteButtonHTML(c.id):''}
        <p class="en">${escapeHTML(c.cardName || c.nameEn)}</p>
        <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHTML(v)}</dd>`).join('')}</dl>
        <h3 class="profile-title">🏎️ 车型档案</h3>
        <dl class="profile">${profile.map(([k, v]) => `<dt>${k}</dt><dd>${v ? escapeHTML(v) : '<span class="na">—</span>'}</dd>`).join('')}</dl>
        ${window.BattleData ? `<div class="battle-performance"><h3>竞速性能 · ${BattleData.templates[BattleData.get(c.id).type].name}</h3>${BattleData.statsHTML(BattleData.get(c.id))}<small>游戏设定 · ${BattleData.get(c.id).reviewed ? '已配置车型定位' : '按名称与车型估算'} · 3D 展示模板</small><a data-battle-car="${c.id}" href="battle.html?car=${encodeURIComponent(c.id)}" ${Store.isFavorite(c.id)?'':'hidden'}>使用此收藏车对战 →</a></div>` : ''}
        <div class="desc">${escapeHTML(c.desc || '这辆小车的故事还在整理中。')}</div>
      </div>
    </div>`;
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.modal-close')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(m);
}

function refreshNavStats() {
  document.querySelectorAll('[data-remain]').forEach((el) => (el.textContent = Store.remaining()));
  document.querySelectorAll('[data-owned]').forEach((el) => (el.textContent = Store.ownedCount()));
  document.querySelectorAll('[data-total]').forEach((el) => (el.textContent = Store.cards.length));
}

function favoriteButtonHTML(id){
  const yes=Store.isFavorite(id);
  return `<button type="button" class="favorite-button" data-favorite="${escapeHTML(id)}" aria-pressed="${yes}" aria-label="${yes?'取消收藏':'加入收藏'}：${escapeHTML(cardTitle(Store.byId[id]))}">${yes?'★ 已收藏':'☆ 加入收藏'}</button>`;
}
function refreshFavorites(){
  document.querySelectorAll('[data-favorite]').forEach(button=>{const id=button.dataset.favorite,yes=Store.isFavorite(id);button.textContent=yes?'★ 已收藏':'☆ 加入收藏';button.setAttribute('aria-pressed',String(yes));button.setAttribute('aria-label',`${yes?'取消收藏':'加入收藏'}：${cardTitle(Store.byId[id])}`);});
  document.querySelectorAll('[data-favorite-count]').forEach(el=>el.textContent=Store.favoriteCards().length);
  document.querySelectorAll('[data-battle-car]').forEach(el=>el.hidden=!Store.isFavorite(el.dataset.battleCar));
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-favorite]');if(!button)return;
  event.preventDefault();
  try{const yes=Store.setFavorite(button.dataset.favorite,!Store.isFavorite(button.dataset.favorite));refreshFavorites();document.dispatchEvent(new CustomEvent('favoriteschange'));toast(yes?'已加入收藏，可在对战中选择':'已取消收藏，车辆仍保留在车库');}catch(error){toast(error.message);}
});
window.addEventListener('storage',event=>{if(event.key==='benben-garage-v1'){refreshFavorites();document.dispatchEvent(new CustomEvent('favoriteschange'));}});
