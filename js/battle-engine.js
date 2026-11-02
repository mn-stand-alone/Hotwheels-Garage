(function () {
  const DT = 1 / 60, MAX = 9000, BOOST = 150, COOLDOWN = 75;
  const duration=p=>Math.round((2+(Math.max(60,Math.min(100,p.stats[3]))-60)*.0125)*60);
  function upgrade(r){
    if(r.version>=6)return r;
    if(r.version===5){r.version=6;return r;}
    for(const [i,c] of r.cars.entries()){
      const oldDuration=150,oldCooldown=i&&r.version>=3?Math.round((1+c.profile.stats[2]*.025)*60):75;
      c.profile=JSON.parse(JSON.stringify(BattleData.get(c.profile.id)));
      c.boost=Math.min(duration(c.profile),Math.round(c.boost/oldDuration*duration(c.profile)));
      c.cooldown=Math.min(BattleAI.cooldown(c.profile),Math.round((c.cooldown||0)/oldCooldown*BattleAI.cooldown(c.profile)));
      c.nitro=i?0:2;if(i)c.ai={nextThink:r.tick,fireAt:null,reason:''};
    }r.version=6;return r;
  }
  function create(track, profiles, seed, id) {
    return { version: 6, id, track, seed: seed >>> 0, tick: 0, status: 'running', inputs: [], events: [],
      cars: profiles.map((p,i) => ({ profile: JSON.parse(JSON.stringify(p)), s: 0, prevS: 0, speed: 0, lane: [-3.5, 0, 3.5][i], prevLane: [-3.5,0,3.5][i], nitro: i ? 0 : 2, ai: i ? { nextThink: 0, fireAt: null, reason: '' } : null, boost: 0, cooldown:0, finish: null, hitUntil: 0, hits: 0 })), contacts: {} };
  }
  function boost(r, i = 0) {
    upgrade(r);
    const c = r.cars[i];
    const unlimited=r.version>=4||(r.version>=2&&i===0);
    if (r.status !== 'running' || c.finish !== null || (!unlimited&&c.nitro<=0) || c.boost>0 || ((unlimited||r.version>=3)&&c.cooldown>0)) return false;
    if(!unlimited)c.nitro--; c.boost = duration(c.profile);
    r.inputs.push({ tick: r.tick, car: i });
    r.events.push({ tick: r.tick, car: i, text: `${c.profile.name} 释放氮气 · ${BattleTracks.zone(r.track,c.s).name}${i&&r.version>=3?' · '+c.ai.reason:''}` });
    return true;
  }
  // Shared by player, AI and matchmaking; no rank-dependent speed bonuses.
  function performance(profile,track,s,boost=false){
    const [top,acc,handling]=profile.stats,zone=BattleTracks.zone(track,s);
    const cruise=55.6+(top-80)*.55;
    const corner=track==='loop'?Math.max(.35,1-zone.curve*(100-handling)/65):1-zone.curve*(100-handling)/100;
    return {cap:cruise*corner+(boost?20*zone.boost:0),acceleration:(14.4+(acc-80)*.24)*(boost?1.6:1)};
  }
  function advanceSpeed(speed,profile,track,s,boost,dt){
    const p=performance(profile,track,s,boost);
    return Math.max(0,speed+Math.max(-20*dt,Math.min(p.acceleration*dt,p.cap-speed)));
  }
  function step(r) {
    if (r.status !== 'running') return;
    upgrade(r);
    const length = BattleTracks.tracks[r.track].length;
    r.cars.forEach((c,i) => {
      c.prevS = c.s; c.prevLane = c.lane;
      if (c.finish !== null) return;
      if (i && BattleAI.nitro(r,c,i)) boost(r,i);
      const handling=c.profile.stats[2];
      c.speed=advanceSpeed(c.speed,c.profile,r.track,c.s,c.boost>0,DT);
      c.lane += (BattleTracks.lane(r.track,c.s,i,r.seed) - c.lane) * Math.min(1, DT * (1.4 + handling / 40));
      c.lane = Math.max(-4.8, Math.min(4.8,c.lane));
      c.s += c.speed * DT;
      if (c.boost > 0){c.boost--;if(c.boost===0){c.cooldown=BattleAI.cooldown(c.profile);}}
      else if(c.cooldown>0)c.cooldown--;
      if (c.s >= length) {
        c.finish = Math.round((r.tick + (length - c.prevS) / Math.max(.0001,c.s-c.prevS)) * DT * 1000);
        c.s = length;
      }
    });
    for (let i=0;i<3;i++) for(let j=i+1;j<3;j++) {
      const a=r.cars[i],b=r.cars[j],key=`${i}:${j}`;
      if (a.finish !== null || b.finish !== null) continue;
      const pa=BattleTracks.frame(r.track,a.s,a.lane),pb=BattleTracks.frame(r.track,b.s,b.lane);
      if (Math.abs(a.s-b.s)<6 && Math.abs(pa.y-pb.y)<2.5 && Math.abs(pa.z-pb.z)<4.2 && Math.abs(pa.x-pb.x)<2.05 && r.tick >= (r.contacts[key] || 0)) {
        r.contacts[key] = r.tick + 100;
        for (const [car,other,direction,index] of [[a,b,-1,i],[b,a,1,j]]) {
          const ratio=other.profile.stats[4]/Math.max(1,car.profile.stats[4]);
          const loss=Math.min(.27, .08 * ratio + (100-car.profile.stats[4])*.001);
          car.speed *= 1-loss; car.lane=Math.max(-4.8,Math.min(4.8,car.lane+direction*.65*ratio));
          car.hitUntil=r.tick+28;car.hits++;
          r.events.push({tick:r.tick,car:index,text:`${car.profile.name} 交汇碰撞 · 降速 ${Math.round(loss*100)}%`});
        }
      }
    }
    r.tick++;
    if (r.cars.every(c=>c.finish!==null) || r.tick >= MAX) r.status='finished';
  }
  function ranking(r) {
    const result=r.cars.map((c,i)=>({i,time:c.finish,progress:c.s})).sort((a,b)=>a.time!==null && b.time!==null ? a.time-b.time : a.time!==null ? -1 : b.time!==null ? 1 : b.progress-a.progress);
    result.forEach((entry,j)=> { const prev=result[j-1]; entry.rank=prev && entry.time===prev.time && (entry.time!==null || Math.abs(entry.progress-prev.progress)<.0001) ? prev.rank : j+1; });
    return result;
  }
  function valid(r) {
    return r && [1,2,3,4,5,6].includes(r.version) && typeof r.id==='string' && r.id.length<100 && BattleTracks.tracks[r.track] && Number.isInteger(r.seed) &&
      Number.isInteger(r.tick) && r.tick>=0 && r.tick<=MAX && ['running','finished','abandoned'].includes(r.status) &&
      Array.isArray(r.cars) && r.cars.length===3 && r.cars.every((c,i)=> c && c.profile && typeof c.profile.name==='string' && typeof c.profile.id==='string' && BattleData.templates[c.profile.type] &&
        Array.isArray(c.profile.stats) && c.profile.stats.length===5 && c.profile.stats.every(v=>Number.isFinite(v)&&v>=(r.version>=5?60:0)&&v<=100) &&
        ['s','prevS','speed','lane','prevLane','hitUntil','hits'].every(k=>Number.isFinite(c[k])) && c.s>=0 && c.s<=BattleTracks.tracks[r.track].length && c.speed>=0 && c.speed<=120 && Math.abs(c.lane)<=5 &&
        (r.version===1||Number.isInteger(c.cooldown)&&c.cooldown>=0&&c.cooldown<=(r.version>=5?BattleAI.cooldown(c.profile):i&&r.version>=3?Math.round((1+c.profile.stats[2]*.025)*60):COOLDOWN)) &&
        Number.isInteger(c.nitro)&&c.nitro>=0&&c.nitro<=(i&&r.version>=4?0:i&&r.version>=3?BattleAI.CHARGES:2) && Number.isInteger(c.boost)&&c.boost>=0&&c.boost<=(r.version>=5?duration(c.profile):BOOST) && (r.version<3||i===0||c.ai&&Number.isInteger(c.ai.nextThink)&&c.ai.nextThink>=0&&c.ai.nextThink<=MAX+60&&(c.ai.fireAt===null||Number.isInteger(c.ai.fireAt)&&c.ai.fireAt>=0&&c.ai.fireAt<=MAX+60)&&typeof c.ai.reason==='string'&&c.ai.reason.length<80) && (c.finish===null || Number.isInteger(c.finish)&&c.finish>=0&&c.finish<=150000)) &&
      Array.isArray(r.inputs)&&r.inputs.length<=(r.version===1?6:128)&&r.inputs.every(e=>Number.isInteger(e.tick)&&e.tick>=0&&e.tick<=r.tick&&[0,1,2].includes(e.car)) &&
      Array.isArray(r.events)&&r.events.length<500&&r.events.every(e=>typeof e.text==='string'&&e.text.length<300&&Number.isInteger(e.tick)&&[0,1,2].includes(e.car)) &&
      r.contacts && typeof r.contacts==='object' && Object.values(r.contacts).every(Number.isFinite);
  }
  window.BattleEngine={ DT, MAX, BOOST, COOLDOWN, duration, upgrade, create, boost, step, ranking, valid, performance, advanceSpeed };
})();
