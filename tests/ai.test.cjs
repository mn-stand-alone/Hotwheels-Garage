const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const e={console};e.window=e;vm.createContext(e);for(const file of ['data','battle-data','battle-tracks','battle-ai','battle-engine'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),e);
const {BattleData:D,BattleAI:A,BattleEngine:E,BattleTracks:T}=e,p=D.trial;
const create=(track='sprint',seed=123)=>E.create(track,[p,p,p],seed,'ai-test');
assert.ok(A.cooldown({stats:[60,60,60,100,60]})<A.cooldown({stats:[60,60,60,60,60]}));
// Current road state stays separate from the 0.2 / 0.35 / 0.5 second forecast.
for(const index of [1,2]){const q=create(),car=q.cars[index];car.s=300;car.speed=50;const samples=[],original=T.zone;try{T.zone=(track,s)=>{samples.push(s);return original(track,s);};assert.equal(A.forecast(q,car,index).horizon,.5);assert.deepEqual(samples,[300,310,317.5,325]);}finally{T.zone=original;}}
// A decision must wait 9..24 fixed simulation ticks, including across JSON snapshots.
const r=create();r.tick=200;r.cars[1].s=500;r.cars[1].speed=55;
assert.equal(A.nitro(r,r.cars[1],1),false);const fire=r.cars[1].ai.fireAt;assert.ok(fire-r.tick>=9&&fire-r.tick<=24);
const clone=JSON.parse(JSON.stringify(r));for(let tick=201;tick<=fire;tick++){r.tick=clone.tick=tick;assert.equal(A.nitro(r,r.cars[1],1),tick===fire);assert.equal(A.nitro(clone,clone.cars[1],1),tick===fire);}assert.equal(JSON.stringify(r),JSON.stringify(clone));
// Do not spend nitro approaching or inside a loop; resume on the exit straight.
for(const index of [1,2]){const q=create('loop');q.tick=300;const c=q.cars[index];c.speed=50;c.s=T.loopStart-20;assert.equal(A.nitro(q,c,index),false);assert.equal(c.ai.fireAt,null);c.s=T.loopStart+T.loopLength-20;q.tick+=30;assert.equal(A.nitro(q,c,index),false);assert.equal(c.ai.fireAt,null);c.s=T.loopStart+T.loopLength+12;q.tick+=30;A.nitro(q,c,index);assert.ok(c.ai.fireAt>q.tick);assert.equal(c.ai.reason,'出弯加速');}
// Engine enforces AI cooldown, not only its decision policy.
const c=create();assert.equal(c.cars[1].nitro,0);assert.equal(c.cars[2].nitro,0);E.boost(c,1);assert.equal(c.cars[1].boost,E.duration(p));for(let i=0;i<E.duration(p);i++)E.step(c);assert.equal(c.cars[1].cooldown,A.cooldown(p));assert.equal(E.boost(c,1),false);
assert.ok(E.valid(c));const bad=JSON.parse(JSON.stringify(c));bad.cars[1].nitro=10;assert.equal(E.valid(bad),false);bad.cars[1].nitro=0;bad.cars[1].ai.fireAt=-1;assert.equal(E.valid(bad),false);
// Same stats and commands produce identical movement for all three car slots.
for(const track of Object.keys(T.tracks)){const q=create(track);q.cars.slice(1).forEach(c=>c.ai.nextThink=E.MAX);while(q.status==='running'){E.step(q);assert.equal(q.cars[0].s,q.cars[1].s);assert.equal(q.cars[1].s,q.cars[2].s);}}
// Match unique vehicles close in expected pace; do not collapse to fixed opponents.
const model=p=>{const card=e.CARDS.find(c=>c.id===p.id);return card?(card.nameEn||card.cardName||card.id).trim().toLowerCase():p.name;};
const picked=new Set();let worst=0;for(const track of Object.keys(T.tracks))for(const shape of Object.keys(D.bodies)){const player=Object.values(D.profiles).find(p=>p.shape===shape),opponents=D.opponents(track,player),target=A.estimate(track,player);assert.notEqual(model(opponents[0]),model(opponents[1]));for(const o of opponents){assert.notEqual(model(o),model(player));const gap=Math.abs(A.estimate(track,o)-target)/target;worst=Math.max(worst,gap);assert.ok(gap<=.03);picked.add(o.id);}}
assert.ok(picked.size>10);
// A long, slow race crosses the former nine-use cap through real cooldowns.
const longRace=create();longRace.cars.forEach(c=>c.profile.stats=[60,60,60,60,60]);while(longRace.status==='running')E.step(longRace);assert.ok(E.valid(longRace));for(const index of [1,2])assert.ok(longRace.inputs.filter(e=>e.car===index).length>9);
for(const track of Object.keys(T.tracks))for(const version of [1,2,3,4,5]){
 const q=create(track);q.version=version;
 while(q.status==='running'){E.boost(q);E.step(q);}assert.equal(q.version,6);assert.ok(E.valid(q));
 for(const i of [1,2])assert.ok(q.inputs.filter(x=>x.car===i).length>2);
}
console.log('PASS half-second prediction, reactions, fair physics, rarity-aware matching, unlimited nitro and global legacy upgrade');

const tiers={common:0,rare:1,epic:2,legend:3};
for(const track of Object.keys(T.tracks))for(const player of Object.values(D.profiles)){
 const opponents=D.opponents(track,player);assert.equal(opponents.length,2);
 assert.notEqual(model(opponents[0]),model(opponents[1]));
 for(const opponent of opponents){assert.ok(tiers[opponent.rarity]<=tiers[player.rarity]);assert.notEqual(model(opponent),model(player));}
}
console.log('PASS all 694 players on all three tracks: both AI tiers never exceed player tier');
