// 进度存储：抽中记录、每日次数、开场动效状态
(function () {
  const KEY = 'benben-garage-v1';
  const DAILY_LIMIT = 10;
  // per：每 10 抽中该稀有度必出的张数
  const RARITY = {
    legend: { name: '传说', en: 'LEGEND', per: 1 },
    epic: { name: '史诗', en: 'EPIC', per: 2 },
    rare: { name: '稀有', en: 'RARE', per: 3 },
    common: { name: '普通', en: 'COMMON', per: 4 },
  };
  const TIERS = ['legend', 'epic', 'rare', 'common'];
  const CYCLE = TIERS.reduce((n, r) => n + RARITY[r].per, 0); // 10

  function newCycle() {
    const seq = TIERS.flatMap((r) => Array(RARITY[r].per).fill(r));
    for (let i = seq.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seq[i], seq[j]] = [seq[j], seq[i]];
    }
    return { seq, pos: 0 };
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  let memory = null; // localStorage 不可用时的兜底
  let persistent = true;
  function load() {
    let s = null;
    try { s = persistent ? JSON.parse(localStorage.getItem(KEY)) : memory; } catch (e) { persistent = false; s = memory; }
    s = s && typeof s === 'object' ? s : {};
    s.owned = s.owned || {};
    if(s.favorites===undefined)s.favorites=[];
    s.daily = s.daily || { date: today(), used: 0 };
    if (s.daily.date !== today()) s.daily = { date: today(), used: 0 };
    return s;
  }
  function save(s) {
    memory = s;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { persistent = false; }
  }

  const cards = window.CARDS || [];
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));

  const Store = {
    DAILY_LIMIT,
    RARITY,
    cards,
    byId,
    today,
    persistent: () => persistent,
    update(fn) { const s = load(); const result = fn(s); save(s); return result; },
    state: () => load(),
    isOwned: (id) => !!load().owned[id],
    isFavorite: id => {const s=load();return Boolean(byId[id]&&s.owned[id]&&Array.isArray(s.favorites)&&s.favorites.includes(id));},
    favoriteCards: () => {const s=load(),ids=new Set(Array.isArray(s.favorites)?s.favorites:[]);return cards.filter(c=>s.owned[c.id]&&ids.has(c.id));},
    setFavorite(id,value) {
      const s=load();if(!byId[id]||!s.owned[id])throw new Error('请先抽到这辆车，再加入收藏');
      const ids=new Set(Array.isArray(s.favorites)?s.favorites:[]);if(value)ids.add(id);else ids.delete(id);
      s.favorites=[...ids];save(s);return Boolean(value);
    },
    ownedCount: () => Object.keys(load().owned).filter((id) => byId[id]).length,
    remaining: () => Math.max(0, DAILY_LIMIT - load().daily.used),
    pool: () => {
      const owned = load().owned;
      return cards.filter((c) => !owned[c.id]);
    },
    CYCLE,
    // 本轮 10 抽的进度：已抽次数与各稀有度尚未出的张数
    cycleInfo() {
      const s = load();
      const cyc = s.cycle && s.cycle.pos < CYCLE ? s.cycle : { seq: [], pos: 0 };
      const left = Object.fromEntries(TIERS.map((r) => [r, cyc.seq.length ? 0 : RARITY[r].per]));
      cyc.seq.slice(cyc.pos).forEach((r) => left[r]++);
      return { pos: cyc.pos, left };
    },
    // 抽一张：每 10 抽为一轮，轮内稀有度序列为 1 传说 + 2 史诗 + 3 稀有 + 4 普通（打乱），
    // 再从该档剩余卡中均匀随机；若该档已抽空，则取最接近的有卡档位
    draw() {
      const s = load();
      if (s.daily.used >= DAILY_LIMIT) return { error: 'limit' };
      const pool = cards.filter((c) => !s.owned[c.id]);
      if (!pool.length) return { error: 'complete' };
      if (!s.cycle || s.cycle.pos >= CYCLE) s.cycle = newCycle();
      const want = s.cycle.seq[s.cycle.pos];
      const wi = TIERS.indexOf(want);
      const tier = TIERS
        .filter((r) => pool.some((c) => c.rarity === r))
        .sort((a, b) => Math.abs(TIERS.indexOf(a) - wi) - Math.abs(TIERS.indexOf(b) - wi) || TIERS.indexOf(a) - TIERS.indexOf(b))[0];
      s.cycle.pos += 1;
      const candidates = pool.filter((c) => c.rarity === tier);
      const card = candidates[Math.floor(Math.random() * candidates.length)];
      s.owned[card.id] = Date.now();
      s.daily.used += 1;
      save(s);
      return { card };
    },
    introSeenToday: () => load().introSeen === today(),
    markIntroSeen() {
      const s = load();
      s.introSeen = today();
      save(s);
    },
    msToMidnight() {
      const n = new Date();
      const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
      return m - n;
    },
    exportJSON: () => JSON.stringify(load(), null, 2),
    importJSON(text) {
      const s = JSON.parse(text);
      const object = v => v && typeof v === 'object' && !Array.isArray(v);
      if (!object(s) || !object(s.owned) || Object.values(s.owned).some(v => !Number.isFinite(v) || v <= 0)) throw new Error('收藏记录格式不正确');
      if(s.favorites!==undefined&&(!Array.isArray(s.favorites)||new Set(s.favorites).size!==s.favorites.length||s.favorites.some(id=>typeof id!=='string'||!byId[id]||!s.owned[id])))throw new Error('收藏车辆数据不正确');
      if (s.daily && (!object(s.daily) || !/^\d{4}-\d{2}-\d{2}$/.test(s.daily.date) || !Number.isInteger(s.daily.used) || s.daily.used < 0 || s.daily.used > DAILY_LIMIT)) throw new Error('每日抽卡数据不正确');
      if (s.cycle && (!object(s.cycle) || !Array.isArray(s.cycle.seq) || s.cycle.seq.length !== CYCLE || s.cycle.seq.some(r => !TIERS.includes(r)) || !Number.isInteger(s.cycle.pos) || s.cycle.pos < 0 || s.cycle.pos > CYCLE)) throw new Error('抽卡轮次格式不正确');
      if (load().battle?.active && window.BattleStore && BattleStore.valid(load().battle)) throw new Error('请先完成或放弃当前比赛，再导入进度');
      if (s.battle && (!window.BattleStore || !BattleStore.valid(s.battle))) throw new Error('对战存档格式不正确');
      save(s);
    },
  };

  window.Store = Store;
})();

function fmtCountdown(ms) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function cardTitle(c) {
  return c.nameZh || c.nameEn || c.cardName || `${c.batch} 神秘小车`;
}
