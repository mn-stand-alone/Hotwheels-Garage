(function () {
  const CHARGES=9;
  const styles=['积极加速','出弯冲刺'];
  // Literal positive correlation requested: handling 0..100 => 1..3.5 seconds.
  const cooldown=profile=>Math.round((1+profile.stats[2]*.025)*60);
  const estimates=new Map(),matches=new Map();
  const modelKeys=new Map((window.CARDS||[]).map(c=>[c.id,(c.nameEn||c.cardName||c.id).trim().toLowerCase()]));
  const modelKey=p=>modelKeys.get(p.id)||p.name;
  function estimate(track,profile){
    const key=track+':'+profile.stats.join(',');if(estimates.has(key))return estimates.get(key);
    let s=0,speed=0,time=0;const dt=.1,length=BattleTracks.tracks[track].length;
    while(s<length&&time<150){speed=BattleEngine.advanceSpeed(speed,profile,track,s,false,dt);const distance=speed*dt;time+=Math.min(dt,(length-s)/Math.max(speed,.001));s+=distance;}
    estimates.set(key,time);return time;
  }
  function match(track,player){
    const key=track+':'+player.id+':'+player.stats.join(',');if(matches.has(key))return matches.get(key);
    const target=estimate(track,player),seen=new Set([modelKey(player)]);
    const candidates=Object.values(BattleData.profiles).filter(p=>{if(seen.has(modelKey(p)))return false;seen.add(modelKey(p));return true;})
      .map(p=>({p,time:estimate(track,p)})).sort((a,b)=>Math.abs(a.time-target)-Math.abs(b.time-target)||a.p.id.localeCompare(b.p.id));
    const first=candidates[0],pool=candidates.filter(c=>c!==first);
    // Prefer a different performance archetype while keeping predicted pace within 3%.
    const second=pool.find(c=>c.p.type!==first.p.type&&Math.abs(c.time-target)/target<=.03)||pool.find(c=>c.p.shape!==first.p.shape&&Math.abs(c.time-target)/target<=.03)||pool[0];
    const result=[first.p,second.p];matches.set(key,result);return result;
  }
  function forecast(race,car,index){
    const horizon=index===1?3:5,speed=Math.max(18,car.speed),length=BattleTracks.tracks[race.track].length;
    const zones=[];for(let t=0;t<=horizon;t+=.5)zones.push(BattleTracks.zone(race.track,Math.min(length,car.s+speed*t)));
    return {horizon,current:zones[0],future:zones.at(-1),safeBoost:zones.slice(0,6).every(z=>z.boost>=.8),exitSoon:zones[0].curve>.8&&zones.some(z=>z.curve<.3)};
  }
  function opportunity(race,car,index){
    const length=BattleTracks.tracks[race.track].length,fraction=car.s/length,remaining=length-car.s,used=race.inputs.filter(input=>input.car===index).length;
    const f=forecast(race,car,index);
    const sprint=remaining<=Math.max(100,car.speed*4)&&remaining>15;
    if(sprint&&f.current.boost>=.8)return '终点冲刺';
    const targets=index===1?[.025,.10,.20,.30,.41,.52,.64,.76,.88]:[.045,.14,.24,.35,.46,.57,.69,.80,.91];
    const pace=Math.max(18,car.speed),timeLeft=remaining/pace;
    const cycle=2.5+cooldown(car.profile)/60+.4;
    const loopMetres=race.track==='loop'?BattleTracks.loopRanges.reduce((sum,l)=>sum+Math.max(0,l.end-Math.max(car.s,l.start)),0):0;
    const budgetPressure=timeLeft-loopMetres/pace<=car.nitro*cycle+2;
    if(!f.safeBoost){
      // Prefer the predicted exit; if no exit is near and straight windows cannot
      // spend the remaining budget, a lower-yield loop boost is still useful.
      return budgetPressure&&f.current.boost<.8&&!f.exitSoon?'剩余氮气调度':'';
    }
    if(f.future.curve>.8&&fraction>.02)return '入弯前直道加速';
    if(fraction<(targets[used]??1)&&!budgetPressure)return '';
    const behind=BattleTracks.zone(race.track,Math.max(0,car.s-pace*1.5));
    if(behind.curve>.8&&f.current.curve<.3)return '出弯加速';
    if(index===2&&car.nitro<=2&&fraction<.72&&!budgetPressure)return '';
    return index===1?'有效直道抢速':'路段预判加速';
  }
  function nitro(race,car,index){
    if(race.version<3){
      const fraction=car.s/BattleTracks.tracks[race.track].length;
      const thresholds=[.19+((race.seed+index*17)%17)/100,.73+((race.seed+index*7)%7)/100];
      return car.nitro>0&&car.boost===0&&fraction>=thresholds[2-car.nitro]&&BattleTracks.zone(race.track,car.s).boost>=.8;
    }
    const a=car.ai;
    if(car.nitro<=0||car.boost>0||car.cooldown>0||car.finish!==null){a.fireAt=null;return false;}
    if(a.fireAt!==null){
      if(race.tick<a.fireAt)return false;
      a.fireAt=null;
      const reason=opportunity(race,car,index);a.reason=reason;
      if(reason)return true;
    }
    if(race.tick<a.nextThink)return false;
    a.nextThink=race.tick+12;
    const reason=opportunity(race,car,index);if(!reason)return false;
    // Seeded 9..24 simulation ticks, persisted so pause/resume cannot reroll decisions.
    const hash=(Math.imul(race.seed^race.tick,index===1?1664525:1013904223)>>>0);
    a.fireAt=race.tick+9+(hash%16);a.reason=reason;return false;
  }
  window.BattleAI={CHARGES,nitro,cooldown,estimate,match,forecast,styles};
})();
