(function () {
  const clone = o => JSON.parse(JSON.stringify(o));
  function fresh() { return { version: 1, daily: {version:2,date:Store.today(),used:0,ids:[],tracks:[]}, selected:'trial', active:null, history:[], total:0, wins:0, abandoned:0, places:{1:0,2:0,3:0}, ties:0, best:{}, badges:[], settled:[] }; }
  function normalize(state) {
    if (!state.battle) state.battle=fresh();
    if (!valid(state.battle)) throw new Error('对战存档格式异常，请先在首页导出备份；原存档未被覆盖');
    const b=state.battle;
    if(b.active)BattleEngine.upgrade(b.active);
    if (b.daily.date!==Store.today()) b.daily={version:2,date:Store.today(),used:0,ids:[],tracks:[]};
    if(b.daily.version!==2){
      const charged=new Set(b.daily.ids),records=[...b.history,...(b.active?[b.active]:[])];
      const matches=records.filter(r=>charged.has(r.id));
      b.daily.tracks=[...new Set([...(b.daily.tracks||[]),...matches.map(r=>r.track)])];
      // Repeated legacy races on one map count once. Unrecoverable charges
      // stay spent conservatively, capped at the new three-race daily limit.
      const unknown=Math.max(0,b.daily.used-new Set(matches.map(r=>r.id)).size);
      b.daily.used=Math.min(3,Math.max(b.daily.tracks.length,b.daily.tracks.length+unknown));
      b.daily.ids=b.daily.ids.slice(0,b.daily.used);
      b.daily.version=2;
    }
    return b;
  }
  function read() { return clone(normalize(Store.state())); }
  function mutate(fn) { return Store.update(s=>fn(normalize(s))); }
  function start(r) {
    if (!BattleEngine.valid(r)) throw new Error('比赛数据不完整');
    if (!Store.isFavorite(r.cars[0].profile.id)) throw new Error('所选车辆已不在当前收藏中，请重新选车');
    mutate(b=>{
      if (b.active) throw new Error('已有未完成比赛，请先继续或弃赛');
      if (b.daily.tracks.includes(r.track)) throw new Error('这个场景今天已游玩，明天再来挑战');
      if (b.daily.used>=3) throw new Error('今天的 3 次对战已经用完');
      b.daily.used++; b.daily.ids.push(r.id); b.daily.tracks.push(r.track); b.selected=r.cars[0].profile.id; b.active=clone(r);
    });
  }
  function checkpoint(r) {
    mutate(b=>{
      if (b.active?.id!==r.id || b.settled.includes(r.id)) throw new Error('比赛存档已变化，请刷新页面');
      b.active=clone(r);
    });
  }
  function settle(r, abandoned=false) {
    return mutate(b=>{
      if (b.settled.includes(r.id)) return b.history.find(h=>h.id===r.id);
      if (b.active?.id!==r.id) throw new Error('当前比赛已在其他页面结束');
      if (!abandoned && r.status!=='finished') throw new Error('比赛尚未结束');
      const rows=BattleEngine.ranking(r), me=rows.find(x=>x.i===0);
      const tie=rows.some(x=>x.i!==0&&x.rank===me.rank);
      const entry={id:r.id,date:new Date().toISOString(),track:r.track,version:r.version,rank:abandoned?null:me.rank,time:r.cars[0].finish,abandoned,tie,car:r.cars[0].profile.name,rows,events:clone(r.events),nitro:r.inputs.filter(e=>e.car===0).length};
      b.total++; if(abandoned)b.abandoned++; else {b.places[me.rank]++;if(tie)b.ties++;if(me.rank===1){b.wins++;if(!b.badges.includes(r.track))b.badges.push(r.track);}}
      if (!abandoned && me.time!==null) {const key=`${r.version}:long:${r.track}`; b.best[key]=Math.min(b.best[key]||Infinity,me.time);}
      b.history.unshift(entry);b.history=b.history.slice(0,30);b.settled.push(r.id);b.settled=b.settled.slice(-200);b.active=null;
      return entry;
    });
  }
  function valid(b) {
    const n=v=>Number.isInteger(v)&&v>=0;
    return b && b.version===1 && b.daily && /^\d{4}-\d{2}-\d{2}$/.test(b.daily.date) && n(b.daily.used)&&b.daily.used<=(b.daily.version===2?3:5) && (b.daily.version===undefined||b.daily.version===2) && Array.isArray(b.daily.ids)&&b.daily.ids.length<=5&&b.daily.ids.every(x=>typeof x==='string') &&
      (b.daily.version!==2&&b.daily.tracks===undefined||Array.isArray(b.daily.tracks)&&b.daily.tracks.length<=3&&new Set(b.daily.tracks).size===b.daily.tracks.length&&b.daily.tracks.length<=b.daily.used&&b.daily.tracks.every(t=>Boolean(BattleTracks.tracks[t]))) &&
      typeof b.selected==='string' && ['total','wins','abandoned','ties'].every(k=>n(b[k])) && b.places && [1,2,3].every(k=>n(b.places[k])) &&
      b.best && typeof b.best==='object' && Object.values(b.best).every(v=>Number.isInteger(v)&&v>=0&&v<=150000) &&
      Array.isArray(b.badges)&&b.badges.every(k=>Boolean(BattleTracks.tracks[k])) && Array.isArray(b.settled)&&b.settled.length<=200&&b.settled.every(x=>typeof x==='string') &&
      Array.isArray(b.history)&&b.history.length<=30&&b.history.every(h=>h && typeof h.id==='string'&&typeof h.car==='string'&&typeof h.date==='string'&&BattleTracks.tracks[h.track]&&[null,1,2,3].includes(h.rank)&&(h.time===null||n(h.time)&&h.time<=150000)&&typeof h.abandoned==='boolean') &&
      (b.active===null || (b.active.status!=='abandoned' && BattleEngine.valid(b.active)));
  }
  let unlock=null;
  async function acquire() {
    if(unlock)return true;
    if(!navigator.locks)throw new Error('浏览器不支持安全的多标签页锁，请使用本地 localhost 地址和新版浏览器');
    return new Promise((resolve,reject)=>{
      navigator.locks.request('benben-battle', {ifAvailable:true}, lock=>{
        if(!lock){resolve(false);return;}
        return new Promise(done=>{unlock=done;resolve(true);});
      }).catch(reject);
    });
  }
  function release(){if(unlock){const done=unlock;unlock=null;done();}}
  function remaining(track){const b=read(),total=Math.max(0,3-b.daily.used);return track?(BattleTracks.tracks[track]&&total>0&&!b.daily.tracks.includes(track)?1:0):total;}
  window.BattleStore={read,start,checkpoint,settle,valid,acquire,release,remaining};
})();
