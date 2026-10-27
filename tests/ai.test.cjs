const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const e={console};e.window=e;vm.createContext(e);for(const file of ['data','battle-data','battle-tracks','battle-ai','battle-engine'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),e);
const {BattleData:D,BattleAI:A,BattleEngine:E,BattleTracks:T}=e,p=D.trial;
const create=(track='sprint',seed=123)=>E.create(track,[p,p,p],seed,'ai-test');
assert.ok(A.cooldown({stats:[0,0,80]})>A.cooldown({stats:[0,0,60]}));
// Both opponents sample only the next 1 second, including the endpoint.
for(const index of [1,2]){const q=create(),car=q.cars[index];car.s=300;car.speed=50;const samples=[],original=T.zone;try{T.zone=(track,s)=>{samples.push(s);return original(track,s);};assert.equal(A.forecast(q,car,index).horizon,1);assert.deepEqual(samples,[300,325,350]);}finally{T.zone=original;}}
// A decision must wait 9..24 fixed simulation ticks, including across JSON snapshots.
const r=create();r.tick=200;r.cars[1].s=500;r.cars[1].speed=55;
assert.equal(A.nitro(r,r.cars[1],1),false);const fire=r.cars[1].ai.fireAt;assert.ok(fire-r.tick>=9&&fire-r.tick<=24);
const clone=JSON.parse(JSON.stringify(r));for(let tick=201;tick<=fire;tick++){r.tick=clone.tick=tick;assert.equal(A.nitro(r,r.cars[1],1),tick===fire);assert.equal(A.nitro(clone,clone.cars[1],1),tick===fire);}assert.equal(JSON.stringify(r),JSON.stringify(clone));
// Do not spend nitro approaching or inside a loop; resume on the exit straight.
for(const index of [1,2]){const q=create('loop');q.tick=300;const c=q.cars[index];c.speed=50;c.s=T.loopStart-30;assert.equal(A.nitro(q,c,index),false);assert.equal(c.ai.fireAt,null);c.s=T.loopStart+T.loopLength-40;q.tick+=30;assert.equal(A.nitro(q,c,index),false);assert.equal(c.ai.fireAt,null);c.s=T.loopStart+T.loopLength+12;q.tick+=30;A.nitro(q,c,index);assert.ok(c.ai.fireAt>q.tick);assert.equal(c.ai.reason,'出弯加速');}
// Engine enforces AI cooldown, not only its decision policy.
const c=create();assert.equal(c.cars[1].nitro,0);assert.equal(c.cars[2].nitro,0);E.boost(c,1);assert.equal(c.cars[1].boost,150);for(let i=0;i<150;i++)E.step(c);assert.equal(c.cars[1].cooldown,A.cooldown(p));assert.equal(E.boost(c,1),false);
assert.ok(E.valid(c));const bad=JSON.parse(JSON.stringify(c));bad.cars[1].nitro=10;assert.equal(E.valid(bad),false);bad.cars[1].nitro=0;bad.cars[1].ai.fireAt=-1;assert.equal(E.valid(bad),false);
// Same stats and commands produce identical movement for all three car slots.
for(const track of Object.keys(T.tracks)){const q=create(track);q.cars.slice(1).forEach(c=>c.ai.nextThink=E.MAX);while(q.status==='running'){E.step(q);assert.equal(q.cars[0].s,q.cars[1].s);assert.equal(q.cars[1].s,q.cars[2].s);}}
// Match unique vehicles close in expected pace; do not collapse to fixed opponents.
const model=p=>{const card=e.CARDS.find(c=>c.id===p.id);return card?(card.nameEn||card.cardName||card.id).trim().toLowerCase():p.name;};
const picked=new Set();let worst=0;for(const track of Object.keys(T.tracks))for(const shape of Object.keys(D.bodies)){const player=Object.values(D.profiles).find(p=>p.shape===shape),opponents=D.opponents(track,player),target=A.estimate(track,player);assert.notEqual(model(opponents[0]),model(opponents[1]));for(const o of opponents){assert.notEqual(model(o),model(player));const gap=Math.abs(A.estimate(track,o)-target)/target;worst=Math.max(worst,gap);assert.ok(gap<=.03);picked.add(o.id);}}
assert.ok(picked.size>10);
// A long, slow race crosses the former nine-use cap through real cooldowns.
const longRace=create();longRace.cars.forEach(c=>c.profile.stats=[0,0,0,0,0]);while(longRace.status==='running')E.step(longRace);assert.ok(E.valid(longRace));for(const index of [1,2])assert.ok(longRace.inputs.filter(e=>e.car===index).length>9);
const report=[];
for(const track of Object.keys(T.tracks)){
 for(const version of [2,3,4]){const q=create(track);q.version=version;if(version===2)q.cars.forEach(c=>c.nitro=2);if(version===3)q.cars.slice(1).forEach(c=>c.nitro=9);while(q.status==='running'){E.boost(q);E.step(q);}assert.ok(E.valid(q));const uses=q.cars.map((c,i)=>q.inputs.filter(x=>x.car===i));if(version<4)assert.ok(uses.slice(1).every(u=>u.length<=(version===3?9:2)));if(version===4){assert.ok(uses.slice(1).every(u=>u.length>=8));assert.ok(q.cars.slice(1).every(c=>c.nitro===0));for(const u of uses.slice(1))for(let j=1;j<u.length;j++)assert.ok(u[j].tick-u[j-1].tick>=150+A.cooldown(p)+9);}if(version===3){assert.ok(uses.slice(1).every(u=>u.length>=8));q.cars.slice(1).forEach((c,i)=>assert.equal(c.nitro,9-uses[i+1].length));assert.notEqual(uses[1][0].tick,uses[2][0].tick);for(const u of uses.slice(1))for(let j=1;j<u.length;j++)assert.ok(u[j].tick-u[j-1].tick>=150+A.cooldown(p)+9);}
 report.push({track,version,seconds:q.cars.map(c=>c.finish/1000),uses:uses.map(u=>u.length),aiFireSeconds:uses.slice(1).map(u=>u.map(x=>+(x.tick/60).toFixed(2)))});
 }
}
console.log('PASS reaction delays, saved pending decisions, loop prediction, enforced cooldown, snapshot validation, fair physics, matched opponents, unlimited charges and legacy charge limits and distinct styles');console.log('Worst matched baseline pace gap:',(worst*100).toFixed(2)+'%');console.log(JSON.stringify(report,null,2));

