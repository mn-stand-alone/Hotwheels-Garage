const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function env(fail=false){const storage=new Map();const context={console,Date,Math,JSON,Number,Object,Array,String,Boolean,Infinity,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('disabled');storage.set(k,v);}},navigator:{},window:{}};context.window=context;vm.createContext(context);for(const name of ['data','store','battle-data','battle-tracks','battle-ai','battle-engine','battle-store'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),context);context.BattleData.trial.id=context.CARDS[0].id;context.Store.update(s=>{s.owned[context.CARDS[0].id]=Date.now();s.favorites=[context.CARDS[0].id];});return context;}
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name);}
const e=env(),D=e.BattleData,E=e.BattleEngine,S=e.BattleStore;
const prof=type=>Object.values(D.profiles).find(p=>p.type===type);
function run(track,profiles,seed=123,inputs=[]){const r=E.create(track,profiles,seed,`test-${seed}`);while(r.status==='running'){if(inputs.includes(r.tick))E.boost(r);E.step(r);}return r;}
test('all 694 cards map to valid ratings, equal budgets and templates',()=>{assert.equal(Object.keys(D.profiles).length,694);for(const p of Object.values(D.profiles)){assert.equal(p.stats.reduce((a,b)=>a+b),350);assert.ok(D.templates[p.type]);}});
test('same model across batches has identical ratings',()=>{const map=new Map();for(const c of e.CARDS){const key=c.nameEn.toLowerCase().trim(),value=JSON.stringify(D.get(c.id).stats);if(map.has(key))assert.equal(map.get(key),value);map.set(key,value);}});
test('24 representative cars finish each track with no player nitro, within 150s',()=>{const list=Object.keys(D.templates).flatMap(type=>Object.values(D.profiles).filter(p=>p.type===type).slice(0,5)).slice(0,24);assert.equal(list.length,24);for(const track of Object.keys(e.BattleTracks.tracks))for(const p of list){const r=run(track,[p,...D.opponents(track)]);assert.ok(r.cars.every(c=>c.finish!==null&&c.finish<=150000));assert.ok(E.valid(r));assert.ok(r.cars.every(c=>Math.abs(c.lane)<=4.8));}});
test('deterministic simulation and snapshot continuation',()=>{const a=run('fork',[prof('impact'),prof('launch'),prof('speed')],37,[300,1800]),b=run('fork',[prof('impact'),prof('launch'),prof('speed')],37,[300,1800]);assert.equal(JSON.stringify(a),JSON.stringify(b));const saved=E.create('loop',[D.trial,...D.opponents('loop')],2,'resume');for(let i=0;i<800;i++)E.step(saved);const clone=JSON.parse(JSON.stringify(saved));while(saved.status==='running')E.step(saved);while(clone.status==='running')E.step(clone);assert.equal(JSON.stringify(saved),JSON.stringify(clone));});
test('player unlimited nitro cooldown and AI unlimited charges',()=>{
 const r=E.create('sprint',[D.trial,D.trial,D.trial],12,'nitro');
 assert.equal(E.boost(r),true);assert.equal(E.boost(r),false);
 for(let i=0;i<150;i++)E.step(r);assert.equal(r.cars[0].cooldown,75);assert.equal(E.boost(r),false);
 for(let i=0;i<74;i++)E.step(r);assert.equal(E.boost(r),false);E.step(r);assert.equal(E.boost(r),true);
 for(let i=0;i<225;i++)E.step(r);assert.equal(E.boost(r),true);assert.ok(E.valid(r));
 const ai=E.create('sprint',[D.trial,D.trial,D.trial],1,'ai');
 for(let i=0;i<20;i++){ai.cars[1].boost=0;ai.cars[1].cooldown=0;assert.equal(E.boost(ai,1),true);}assert.equal(ai.cars[1].nitro,0);assert.ok(E.valid(ai));
 for(const version of [1,2]){const old=E.create('sprint',[D.trial,D.trial,D.trial],1,'old');old.version=version;old.cars.forEach(c=>{c.nitro=2;if(version===1)delete c.cooldown;});assert.ok(E.valid(old));assert.ok(E.boost(old,1));old.cars[1].boost=0;assert.ok(E.boost(old,1));old.cars[1].boost=0;assert.equal(E.boost(old,1),false);}

});
test('unlimited inputs survive save restoration beyond two uses',()=>{
 const r=E.create('loop',[D.trial,...D.opponents('loop')],2,'many');while(r.tick<900){if(r.tick%225===0)E.boost(r);E.step(r);}assert.equal(r.inputs.filter(x=>x.car===0).length,4);
 const clone=JSON.parse(JSON.stringify(r));assert.ok(E.valid(clone));while(r.status==='running')E.step(r);while(clone.status==='running')E.step(clone);assert.equal(JSON.stringify(r),JSON.stringify(clone));
});
test('body classes and per-name stats cover all cards',()=>{
 const shapes=new Set(Object.values(D.profiles).map(p=>p.shape));assert.ok(shapes.size>=5);assert.ok(new Set(Object.values(D.profiles).map(p=>p.stats.join(','))).size>100);
 for(const [name,shape] of [['Mazda MX-5 Miata','convertible'],['Tesla Model S Plaid','sedan'],['Ferrari F40','sport'],['Land Rover Defender 90','offroad'],["Ford F-150 Raptor",'pickup']])assert.equal(D.classify(name),shape);
});
test('settlement counts unlimited inputs and cooldown survives backup',()=>{
 const c=env(),r=c.BattleEngine.create('sprint',[c.BattleData.trial,...c.BattleData.opponents('sprint')],12,'v2-save');c.BattleStore.start(r);
 while(r.status==='running'){if(r.tick%225===0)c.BattleEngine.boost(r);c.BattleEngine.step(r);if(r.tick===160){c.BattleStore.checkpoint(r);const backup=c.Store.exportJSON();const imported=env();imported.Store.importJSON(backup);assert.equal(imported.BattleStore.read().active.cars[0].cooldown,65);}}
 const used=r.inputs.filter(e=>e.car===0).length;assert.ok(used>2);c.BattleStore.settle(r);assert.equal(c.BattleStore.read().history[0].nitro,used);assert.ok(c.BattleStore.read().best['4:long:sprint']);
});
test('loop frame is continuous, inverted at apex, no teleport at exit',()=>{const T=e.BattleTracks,a=T.frame('loop',T.loopStart+T.loopLength/2);assert.ok(a.y>90);assert.ok(Math.abs(a.angle-Math.PI)<.02);for(const boundary of [T.loopStart,T.loopStart+T.loopLength]){const a=T.frame('loop',boundary-.001),b=T.frame('loop',boundary+.001);assert.ok(Math.hypot(a.y-b.y,a.z-b.z)<.01);}});
test('collisions occur and heavy car has lower proportional loss',()=>{const r=E.create('fork',[prof('impact'),prof('launch'),prof('launch')],1,'hit');for(const c of r.cars){c.s=c.prevS=400;c.lane=c.prevLane=0;c.speed=40;}E.step(r);assert.ok(r.cars[0].hits>0);assert.ok(r.cars[0].speed>r.cars[1].speed);});
test('equal finish timestamps receive tied rank; timeout orders progress',()=>{const r=E.create('sprint',[D.trial,D.trial,D.trial],1,'rank');r.cars.forEach(c=>c.finish=35000);assert.ok(E.ranking(r).every(x=>x.rank===1));r.cars.forEach((c,i)=>{c.finish=null;c.s=100+i*10;});r.tick=E.MAX-1;E.step(r);assert.equal(r.status,'finished');assert.equal(E.ranking(r)[0].i,2);});
test('one start per track, three total, snapshots and duplicate settlement never double charge',()=>{
 const drawBefore=e.Store.remaining(),tracks=['sprint','fork','loop'];
 for(let n=0;n<3;n++){const r=E.create(tracks[n],[D.trial,D.trial,D.trial],n,'daily-'+n);S.start(r);S.checkpoint(r);assert.equal(S.remaining(),2-n);assert.equal(S.remaining(tracks[n]),0);while(r.status==='running')E.step(r);S.checkpoint(r);S.settle(r);S.settle(r);assert.equal(S.read().total,n+1);assert.throws(()=>S.start(E.create(tracks[n],[D.trial,D.trial,D.trial],n,'repeat-'+n)),/场景/);assert.equal(S.remaining(),2-n);}
 assert.equal(S.remaining(),0);assert.equal(e.Store.remaining(),drawBefore);assert.equal(S.read().wins+S.read().places[2]+S.read().places[3],3);assert.ok(S.valid(S.read()));
});
test('cross-day active race resumes without new daily charge',()=>{const c=env(),r=c.BattleEngine.create('loop',[c.BattleData.trial,...c.BattleData.opponents('loop')],3,'midnight');c.BattleStore.start(r);c.Store.update(s=>s.battle.daily.date='2000-01-01');assert.equal(c.BattleStore.remaining(),3);c.BattleStore.checkpoint(r);assert.equal(c.BattleStore.remaining(),3);c.BattleStore.settle(r,true);assert.equal(c.BattleStore.read().abandoned,1);});
test('old import keeps collection and draw cycle, invalid import leaves save untouched',()=>{const c=env();c.Store.draw();const before=c.Store.exportJSON();c.Store.importJSON(before);assert.equal(c.Store.exportJSON(),before);assert.throws(()=>c.Store.importJSON('{"owned":null}'));assert.equal(c.Store.exportJSON(),before);const bad=JSON.parse(before);bad.battle={version:1};assert.throws(()=>c.Store.importJSON(JSON.stringify(bad)));assert.equal(c.Store.exportJSON(),before);});
test('new backup round-trip and reject import while race active',()=>{const c=env();c.Store.importJSON(e.Store.exportJSON());assert.ok(c.BattleStore.valid(c.BattleStore.read()));const r=c.BattleEngine.create('sprint',[c.BattleData.trial,c.BattleData.trial,c.BattleData.trial],1,'active');c.Store.update(s=>s.battle.daily.date='2000-01-01');c.BattleStore.start(r);assert.throws(()=>c.Store.importJSON('{"owned":{}}'));});
test('storage failures retain current session state',()=>{const c=env(true);c.Store.draw();assert.ok(c.Store.ownedCount()>=1);assert.equal(c.Store.persistent(),false);const r=c.BattleEngine.create('sprint',[c.BattleData.trial,c.BattleData.trial,c.BattleData.trial],1,'memory');c.BattleStore.start(r);assert.equal(c.BattleStore.remaining(),2);});
test('first win awards badge once and retains personal best',()=>{const c=env();for(let n=0;n<2;n++){if(n)c.Store.update(s=>s.battle.daily.date='2000-01-01');const r=c.BattleEngine.create('sprint',[c.BattleData.trial,c.BattleData.trial,c.BattleData.trial],n,'win-'+n);c.BattleStore.start(r);r.status='finished';r.cars.forEach((car,i)=>{car.s=car.prevS=1450;car.finish=25000+n*1000+i*300;});c.BattleStore.settle(r);}const b=c.BattleStore.read();assert.equal(b.wins,2);assert.equal(b.badges.length,1);assert.equal(b.best['4:long:sprint'],25000);});
test('invalid local battle data is preserved and can be replaced with valid backup',()=>{const c=env();c.Store.update(s=>s.battle={active:{bad:true}});const before=c.Store.exportJSON();assert.throws(()=>c.BattleStore.read());assert.equal(c.Store.exportJSON(),before);c.Store.importJSON('{"owned":{}}');assert.equal(c.BattleStore.remaining(),3);});
test('abandonment, reload and backup keep per-track quota; new day resets all tracks',()=>{
 const c=env(),make=t=>c.BattleEngine.create(t,[c.BattleData.trial,c.BattleData.trial,c.BattleData.trial],1,'quota-'+t);
 const r=make('fork');c.BattleStore.start(r);c.BattleStore.settle(r,true);const restored=env();restored.Store.importJSON(c.Store.exportJSON());assert.equal(restored.BattleStore.remaining('fork'),0);assert.equal(restored.BattleStore.remaining('loop'),1);assert.equal(restored.BattleStore.remaining(),2);
 c.Store.update(s=>s.battle.daily.date='2000-01-01');assert.equal(c.BattleStore.remaining(),3);assert.equal(c.BattleStore.remaining('fork'),1);c.BattleStore.start(make('fork'));assert.equal(c.BattleStore.remaining(),2);
});
test('legacy daily records migrate by charged IDs, including active races',()=>{
 const c=env(),r=c.BattleEngine.create('loop',[c.BattleData.trial,c.BattleData.trial,c.BattleData.trial],1,'legacy-active');c.BattleStore.start(r);c.Store.update(s=>{delete s.battle.daily.tracks;delete s.battle.daily.version;});
 assert.equal(c.BattleStore.remaining('loop'),0);assert.equal(c.BattleStore.remaining(),2);c.BattleStore.settle(r,true);c.Store.update(s=>{delete s.battle.daily.tracks;delete s.battle.daily.version;});assert.equal(c.BattleStore.remaining('loop'),0);
 c.Store.update(s=>{delete s.battle.daily.version;s.battle.daily.used=5;s.battle.daily.ids=['legacy-active','2','3','4','5'];delete s.battle.daily.tracks;});assert.equal(c.BattleStore.remaining(),0);assert.ok(c.BattleStore.valid(c.BattleStore.read()));
 const bad=c.BattleStore.read();bad.daily.tracks=['sprint','sprint'];assert.equal(c.BattleStore.valid(bad),false);
});
// Report comparative performance; every archetype should have a meaningful trade-off.
const report={};for(const track of Object.keys(e.BattleTracks.tracks)){report[track]={};for(const type of Object.keys(D.templates)){const results=[];for(let seed=0;seed<20;seed++){const r=run(track,[prof(type),...D.opponents(track)],seed,[500,1400]);results.push(r.cars[0].finish);}report[track][type]=Math.round(results.reduce((a,b)=>a+b)/results.length);}}
console.log('Mean player finish milliseconds (20 seeds):',JSON.stringify(report));
test('different track types have distinct best archetypes in baseline sweep',()=>{const winner=track=>Object.entries(report[track]).sort((a,b)=>a[1]-b[1])[0][0];assert.equal(winner('sprint'),'speed');assert.equal(winner('fork'),'impact');assert.equal(winner('loop'),'handling');});
test('banked and inverted road frames stay orthonormal and lanes stay on road',()=>{
  const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),T=e.BattleTracks;
  for(const track of Object.keys(T.tracks))for(let s=0;s<=T.tracks[track].length;s+=3){
    const f=T.frame(track,s);for(const v of [f.right,f.up,f.forward])assert.ok(Math.abs(dot(v,v)-1)<1e-8);
    assert.ok(Math.abs(dot(f.right,f.up))<1e-8);assert.ok(Math.abs(dot(f.up,f.forward))<1e-8);assert.ok(Math.abs(dot(f.right,f.forward))<1e-8);
    if(track==='sprint'){const lane=T.frame(track,s,3),delta=[lane.x-f.x,lane.y-f.y,lane.z-f.z];assert.ok(Math.abs(dot(delta,f.up))<1e-8);assert.ok(Math.abs(Math.hypot(...delta)-3)<1e-8);}
  }
  assert.ok(Math.abs(T.frame('sprint',280).bank)>.2);
  assert.ok(T.frame('loop',T.loopStart+T.loopLength/2).up[1]<-.99);
});
console.log(`${passed} tests passed`);
