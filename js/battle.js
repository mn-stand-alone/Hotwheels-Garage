const $=id=>document.getElementById(id), esc=escapeHTML;
let scene=null, race=null, preview=null, track='sprint', running=false, ready=false, starting=false, countdown=0, last=0, accumulator=0, lastEvent=-1, fpsElapsed=0, fpsFrames=0;
let audioEvent=0, audioCooldown=0;
function raceAudio(){
  if(!race)return;
  const c=race.cars[0];
  if(running){for(const e of race.events.slice(audioEvent)){if(e.text.includes("交汇碰撞"))window.GameAudio?.sfx("collision");else if(e.text.startsWith(c.profile.name+" 释放氮气"))window.GameAudio?.sfx("nitro");}
  if(audioCooldown>0&&c.cooldown===0&&c.finish===null)window.GameAudio?.sfx("ready");}
  audioEvent=race.events.length;audioCooldown=c.cooldown||0;
}
const notice=message=>{ $('notice').textContent=message;$('notice').hidden=!message; };
function overlay(title,text,resume=false){$('overlay').hidden=false;$('overlayTitle').textContent=title;$('overlayText').textContent=text;$('resume').hidden=!resume;}
function availableCars(){return Store.favoriteCards();}
function selectedProfile(){return BattleData.get($('carSelect').value);}
function profiles(){return [selectedProfile(),...BattleData.opponents(track,selectedProfile())];}
function fillCars(){
  const owned=availableCars();
  $('carSelect').innerHTML=owned.length?owned.map(c=>`<option value="${esc(c.id)}">${esc(cardTitle(c))}</option>`).join(''):'<option value="" disabled>请先在车库收藏车辆</option>';
  const selected=new URLSearchParams(location.search).get('car') || BattleStore.read().selected;
  if([...$('carSelect').options].some(o=>o.value===selected))$('carSelect').value=selected;
}
function profileUI(){
  if(!race&&!Store.isFavorite($('carSelect').value)){$('carProfile').innerHTML='<p class="profile-note">暂无收藏车辆。<a href="garage.html">前往车库添加收藏 →</a></p>';$('opponents').innerHTML='收藏并选车后匹配对手。';return;}
  const p=selectedProfile(),card=Store.byId[p.id];
  $('carProfile').innerHTML=`<div class="car-card">${card?`<img src="${esc(card.thumb)}" alt="${esc(p.name)}">`:'<div class="trial-car" aria-hidden="true">🏎</div>'}<div><b>${esc(p.name)}</b><small>${BattleData.templates[p.type].name}${card?'':' · 体验车'}</small></div></div>${BattleData.statsHTML(p)}<p class="profile-note">${p.reviewed?'已配置车型定位 · 同车型共享性能':'按车型与名称估算 · 游戏性能'}<br>${BattleData.bodies[p.shape]?.name||"经典车身"} · 同车型跨批次共享性能。</p>`;
  const img=$('carProfile').querySelector('img');if(img)img.addEventListener('error',()=>{img.hidden=true;});
  $('opponents').innerHTML=(race?race.cars.slice(1).map(c=>c.profile):BattleData.opponents(track,p)).map((p,i)=>`<div class="opponent"><b>AI 0${i+2} · ${esc(p.name)} / ${BattleData.templates[p.type].name}</b><small>${race&&race.version<3?'旧版策略 · 氮气 2 次':`${BattleAI.styles[i]} · 氮气 ${race&&race.version===3?'限次':'无限次'} · 恢复 ${(BattleAI.cooldown(p)/60).toFixed(2)} 秒`}</small>${BattleData.statsHTML(p)}</div>`).join('');
}
function syncRaceUI(){
  const c=race.cars[0].profile;
  if(![...$('carSelect').options].some(o=>o.value===c.id))$('carSelect').insertAdjacentHTML('beforeend',`<option value="${esc(c.id)}">${esc(c.name)} · 比赛快照</option>`);
  $('carSelect').value=c.id;
  document.querySelectorAll('.track-option').forEach(b=>{b.classList.toggle('selected',b.dataset.track===track);b.setAttribute('aria-pressed',b.dataset.track===track);});
  profileUI();
  $('sceneTitle').textContent=BattleTracks.tracks[track].name;
  $('sceneCaption').innerHTML=`<b>${BattleTracks.tracks[track].subtitle}</b><span>${esc(BattleTracks.tracks[track].desc)}</span>`;
}
function refreshRecords(){
  const b=BattleStore.read();$('remaining').textContent=BattleStore.remaining();
  document.querySelectorAll('[data-quota]').forEach(el=>el.textContent=b.daily.tracks.includes(el.dataset.quota)?'今日已游玩':BattleStore.remaining(el.dataset.quota)?'今日可玩 1 次':'今日总次数已用完');
  $('stats').innerHTML=`<div><b>${b.total}</b><small>累计比赛</small></div><div><b>${b.wins}</b><small>冠军次数</small></div><div><b>${b.badges.length} / 3</b><small>赛道首胜徽章</small></div>`;
  $('history').innerHTML=b.history.length?b.history.map(h=>`<div class="history-card"><b>${h.abandoned?'已弃赛':`${h.tie?'并列 ':''}P${h.rank}`} · ${BattleTracks.tracks[h.track].name}</b>${esc(h.car)}<small>${h.time!==null?(h.time/1000).toFixed(3)+' 秒':'未完成'} · ${esc(h.date.slice(0,10))}</small></div>`).join(''):'<p class="history-empty">还没有比赛记录。第一次冲线，会被记在这里。</p>';
  const best=b.best[`4:long:${track}`];if(!race)$('gap').textContent=best?`本站个人最佳 ${(best/1000).toFixed(3)} 秒 · ${b.badges.includes(track)?'已获得首胜徽章':'等待首胜'}`:'玩家无限氮气 · AI 无限氮气';
  if(!Store.persistent())notice('浏览器无法保存进度：当前为会话内体验，关闭后战绩及每日次数可能丢失。');
}
function setDisabled(value){$('carSelect').disabled=value;document.querySelectorAll('.track-option').forEach(b=>b.disabled=value);document.body.classList.toggle('racing',value);}
function startLabel(){const b=BattleStore.read();$('start').disabled=(!race&&!Store.isFavorite($('carSelect').value))||!ready||starting||running||Boolean(race)||BattleStore.remaining(track)===0;$('start').textContent=!race&&!Store.isFavorite($('carSelect').value)?'请先在车库收藏车辆':!ready?'3D 场景未就绪':race?.status==='finished'||race?.status==='abandoned'?'本场已结束，请返回选车':running?'自动竞速进行中':b.active?'请继续未完成比赛':BattleStore.remaining(track)===0?(b.daily.tracks.includes(track)?'此场景今日已游玩':'今日对战已用完'):'发车  →  使用 1 次对战';}
function buildPreview(){
  if(!scene||race)return;
  ready=false;
  try{preview=BattleEngine.create(track,profiles(),1,'preview');scene.build(track,profiles());scene.render(preview,1,true);ready=true;$('overlay').hidden=true;if(!Store.isFavorite($('carSelect').value))overlay('先收藏一辆座驾','前往车库点击 ☆ 加入收藏，再回来选择座驾。');}
  catch(e){overlay('3D 场景加载失败','未扣除次数。请刷新页面或更换支持 WebGL 2 的浏览器。');notice(e.message);}
  $('sceneTitle').textContent=BattleTracks.tracks[track].name;
  $('sceneCaption').innerHTML=`<b>${BattleTracks.tracks[track].subtitle}</b><span>${esc(BattleTracks.tracks[track].desc)}</span>`;
  startLabel();refreshRecords();
}
function hud(){
  if(!race)return;
  raceAudio();
  const c=race.cars[0],rows=BattleEngine.ranking(race),me=rows.find(x=>x.i===0),leader=race.cars[rows[0].i];
  $('position').innerHTML=`${me.rank}<span> / 3</span>`;$('clock').textContent=(race.tick/60).toFixed(3).padStart(6,'0');$('speed').textContent=Math.round(c.speed*3.6);
  $('raceProgress').style.width=`${100*c.s/BattleTracks.tracks[race.track].length}%`;
  $('zone').textContent=BattleTracks.zone(race.track,c.s).name+' / 自动驾驶';
  $('gap').textContent=me.rank===1?'你正在领跑':`距离领跑车辆 ${Math.max(0,leader.s-c.s).toFixed(1)} 米`;
  $('raceHint').textContent=race.status==='finished'?'比赛结束，查看下方成绩与关键事件。':race.status==='abandoned'?'本场已弃赛。':c.finish!==null?'你已冲线，等待其他车辆完成。':c.boost?'氮气生效中！车辆仍由自动驾驶控制。':'观察前方路段，点击按钮或按空格释放氮气。';
  const unlimited=race.version>=2;
  $('nitro').disabled=!running||(!unlimited&&c.nitro<=0)||c.boost>0||(unlimited&&c.cooldown>0)||c.finish!==null;
  $('nitro').classList.toggle('boosting',c.boost>0);
  $('nitroText').textContent=c.finish!==null?'已冲线':!running?'比赛未进行':c.boost?`加速 ${(c.boost/60).toFixed(1)} 秒`:unlimited?(c.cooldown?`恢复中 ${(c.cooldown/60).toFixed(2)} 秒`:'无限次 · 空格释放'):c.nitro?`剩余 ${c.nitro} 次 · 空格键`:'本场氮气已用完';
  $('nitro').style.setProperty('--nitro-ready',`${unlimited&&c.cooldown?100*(1-c.cooldown/BattleEngine.COOLDOWN):100}%`);
  if(race.events.length!==lastEvent){lastEvent=race.events.length;$('eventLine').textContent=race.events.at(-1)?.text||'绿灯亮起，全自动竞速开始！';}
}
async function begin(){
  if(!ready||race||starting||running)return;
  starting=true;setDisabled(true);startLabel();
  try{
    if(!await BattleStore.acquire())throw new Error('另一个标签页正在比赛，请先在该页面暂停或退出。');
    if(BattleStore.read().active)throw new Error('发现未完成比赛，请刷新页面后继续。');
    if(!BattleStore.remaining(track))throw new Error('此场景今日已游玩或今天的 3 次对战已经用完');
    if(!Store.isFavorite(selectedProfile().id))throw new Error('这辆车尚未收藏，请重新选车');
    const seed=crypto.getRandomValues(new Uint32Array(1))[0];
    preview=BattleEngine.create(track,profiles(),seed,crypto.randomUUID());scene.build(track,profiles());scene.render(preview,1,true);
    document.querySelector('.race-column').scrollIntoView({block:'start',behavior:'instant'});
    countdown=3;window.GameAudio?.sfx('countdown');overlay('3','自动驾驶已就绪 · 空格或点击释放氮气');
  }catch(e){starting=false;countdown=0;setDisabled(false);BattleStore.release();notice(e.message);startLabel();}
}
function launch(){
  try{BattleStore.start(preview);race=preview;preview=null;audioEvent=0;audioCooldown=0;running=true;window.GameAudio?.setMode('race-'+race.track);window.GameAudio?.sfx('go');starting=false;lastEvent=-1;accumulator=0;$('overlay').hidden=true;$('abandon').hidden=false;$('result').hidden=true;refreshRecords();startLabel();hud();}
  catch(e){starting=false;countdown=0;BattleStore.release();setDisabled(false);notice(e.message);$('overlay').hidden=true;startLabel();}
}
function pause(reason){
  if(starting){starting=false;countdown=0;BattleStore.release();setDisabled(false);$('overlay').hidden=true;startLabel();return;}
  if(!race||!running)return;
  running=false;window.GameAudio?.drive();window.GameAudio?.setMode('lobby');accumulator=0;
  try{BattleStore.checkpoint(race);}catch(e){notice(e.message);}
  BattleStore.release();overlay('比赛已暂停',reason,true);hud();
}
async function resume(){
  if(running||starting||!ready)return;
  try{
    if(!await BattleStore.acquire())throw new Error('另一个标签页正在进行这场比赛，请先切回该页面。');
    const saved=BattleStore.read().active;if(!saved)throw new Error('比赛已在其他页面结束，请刷新页面');
    if(!BattleEngine.valid(saved))throw new Error('比赛快照损坏，请导出备份并检查存档');
    race=saved;track=race.track;scene.build(track,race.cars.map(c=>c.profile));ready=true;setDisabled(true);syncRaceUI();
    if(race.status==='finished'){finish();return;}
    audioEvent=race.events.length;audioCooldown=race.cars[0].cooldown||0;running=true;window.GameAudio?.setMode('race-'+race.track);accumulator=0;last=performance.now();$('overlay').hidden=true;$('abandon').hidden=false;startLabel();hud();
  }catch(e){BattleStore.release();notice(e.message);}
}
function nitro(){if(!running||!race)return;if(BattleEngine.boost(race)){try{BattleStore.checkpoint(race);}catch(e){pause(e.message);}hud();}}
function finish(abandoned=false){
  running=false;starting=false;window.GameAudio?.drive();window.GameAudio?.setMode('lobby');
  if(!abandoned)window.GameAudio?.sfx(BattleEngine.ranking(race).find(r=>r.i===0).rank===1?'win':'finish');
  try{const result=BattleStore.settle(race,abandoned);showResult(result);}catch(e){notice(e.message);overlay('结算暂未保存',e.message,true);}
  BattleStore.release();$('abandon').hidden=true;hud();refreshRecords();startLabel();
}
function showResult(entry){
  $('overlay').hidden=true;$('result').hidden=false;$('resultTitle').textContent=entry.abandoned?'已结束本场比赛':entry.rank===1?`${entry.tie?'并列冠军':'冠军！'} 这次，跑在最前。`:`第 ${entry.rank} 名 · 下一次，再快一点。`;
  const rows=BattleEngine.ranking(race);
  $('resultRows').innerHTML=rows.map(row=>`<div class="result-row ${row.i===0?'me':''}"><b>P${row.rank}</b><span>${row.i===0?'你':'AI 0'+(row.i+1)} · ${esc(race.cars[row.i].profile.name)}</span><b>${row.time!==null?(row.time/1000).toFixed(3)+'s':'未完成'}</b></div>`).join('');
  const c=race.cars[0];$('resultAnalysis').textContent=`${BattleData.templates[c.profile.type].name} · 使用 ${race.inputs.filter(e=>e.car===0).length} 次氮气 · 经历 ${c.hits} 次碰撞。${entry.abandoned?'本次已计入每日次数，不影响抽卡。':race.track==='fork'?'交汇区会发生推挤，重量和稳定有助于降低速度损失。':race.track==='loop'?'回环中操控影响限速，出环直道能发挥更完整的氮气增益。':'极速决定长直道上限，加速影响起步及氮气响应。'}`;
  $('resultEvents').innerHTML=race.events.length?race.events.map(e=>`<li>${(e.tick/60).toFixed(2)}s · ${esc(e.text)}</li>`).join(''):'<li>本场没有氮气或碰撞事件。</li>';
  $('result').focus({preventScroll:true});
}
async function abandon(){
  if(!race||!confirm('放弃本场比赛？将记录为弃赛，已使用的对战次数不退还。'))return;
  if(!running){if(!await BattleStore.acquire()){notice('其他标签页正在比赛，请先切回该页面。');return;}const saved=BattleStore.read().active;if(!saved){BattleStore.release();notice('比赛已经结束，请刷新页面');return;}race=saved;}
  race.status='abandoned';finish(true);
}
function reset(){race=null;running=false;lastEvent=-1;setDisabled(false);$('result').hidden=true;$('abandon').hidden=true;$('clock').textContent='00.000';$('speed').textContent='0';$('position').innerHTML='—<span> / 3</span>';$('raceProgress').style.width='0%';$('raceHint').textContent='起步、转向与冲线交给赛车，氮气时机交给你。';$('zone').textContent='AUTOPILOT / 自动驾驶';$('nitroText').textContent='无限次 · 恢复 1.25 秒';$('nitro').classList.remove('boosting');fillCars();profileUI();buildPreview();}
function frame(now){
  const elapsed=last?(now-last)/1000:0;last=now;
  if(!document.hidden&&elapsed>0&&elapsed<1){fpsElapsed+=elapsed;fpsFrames++;if(fpsElapsed>=1){$('fps').textContent=`${Math.round(fpsFrames/fpsElapsed)} FPS`;fpsElapsed=0;fpsFrames=0;}}
  try{
    if(starting&&countdown>0){const previous=Math.ceil(countdown);countdown-=Math.min(elapsed,.1);if(Math.ceil(countdown)>0&&Math.ceil(countdown)<previous)window.GameAudio?.sfx('countdown');$('overlayTitle').textContent=String(Math.max(1,Math.ceil(countdown)));if(countdown<=0)launch();}
    if(running&&race){
      if(elapsed>1){pause('页面暂时停止响应，比赛已暂停。点击继续，不会重复扣次。');}
      else{accumulator+=elapsed;while(accumulator>=BattleEngine.DT&&running){BattleEngine.step(race);accumulator-=BattleEngine.DT;if(race.tick%60===0)BattleStore.checkpoint(race);if(race.status==='finished')finish();}hud();}
    }
    window.GameAudio?.drive(race?.cars[0].speed||0,Boolean(race?.cars[0].boost),running&&race?.cars[0].finish===null);
    if(scene&&ready)scene.render(race||preview,running?accumulator/BattleEngine.DT:1,!race);
  }catch(e){pause('比赛发生异常，已尝试保存进度。');notice(e.message);}
  requestAnimationFrame(frame);
}
async function boot(){
  fillCars();
  $('tracks').innerHTML=Object.values(BattleTracks.tracks).map(t=>`<button class="track-option ${t.id===track?'selected':''}" data-track="${t.id}" aria-pressed="${t.id===track}" style="--track-color:${t.color}"><span class="track-icon">${t.icon}</span><span><small>${t.label}</small><b>${t.name} · ${(t.length/1000).toFixed(1)} km</b><small class="track-focus">${t.focus}</small><small data-quota="${t.id}"></small></span></button>`).join('');
  $('tracks').addEventListener('click',e=>{const b=e.target.closest('[data-track]');if(!b||race||starting)return;track=b.dataset.track;document.querySelectorAll('.track-option').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',el===b);});profileUI();buildPreview();});
  $('carSelect').addEventListener('change',()=>{profileUI();buildPreview();});
  $('start').addEventListener('click',begin);$('resume').addEventListener('click',resume);$('nitro').addEventListener('click',nitro);$('abandon').addEventListener('click',abandon);$('again').addEventListener('click',reset);
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&running&&!e.target.closest('.audio-panel')&&!['SELECT','INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName)){e.preventDefault();if(!e.repeat)nitro();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('页面已切换到后台，比赛暂停。点击继续后恢复。');});
  window.addEventListener('pagehide',()=>{pause('离开页面，已保存进度。');BattleStore.release();});
  window.addEventListener('storage',e=>{if(e.key==='benben-garage-v1'){refreshRecords();if(!race&&!starting){fillCars();profileUI();buildPreview();startLabel();}}});
  profileUI();refreshRecords();
  try{
    const {BattleScene}=await import('./battle-scene.js?v=tracks-20261026');
    scene=new BattleScene($('scene'),()=>{pause('3D 渲染中断，等待恢复。');ready=false;startLabel();},()=>{ready=true;notice('3D 场景已恢复，可以继续比赛。');if(!race)buildPreview();});
    scene.effects=!matchMedia('(prefers-reduced-motion: reduce)').matches;$('effects').checked=scene.effects;
    $('quality').addEventListener('change',()=>scene.quality($('quality').value==='low'));
    $('effects').addEventListener('change',()=>scene.effects=$('effects').checked);
    buildPreview();
    const active=BattleStore.read().active;
    if(active){if(!BattleEngine.valid(active))throw new Error('未完成比赛数据不完整，请先备份存档');race=active;track=race.track;scene.build(track,race.cars.map(c=>c.profile));setDisabled(true);syncRaceUI();$('abandon').hidden=false;overlay('还有一场比赛等你','继续上次进度，不会重复扣除对战次数。',true);hud();startLabel();}
    requestAnimationFrame(frame);
  }catch(e){ready=false;overlay('无法创建 3D 赛场','未扣除次数。请开启浏览器硬件加速后刷新，或使用支持 WebGL 2 的浏览器。');notice(e.message);startLabel();}
}
boot().catch(e=>{notice(e.message);overlay('暂时无法进入赛场','请先在首页导出进度备份，原存档未被覆盖。');});
