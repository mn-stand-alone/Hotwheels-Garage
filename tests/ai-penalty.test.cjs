const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function env(fail=false){const storage=new Map();const context={console,Date,Math,JSON,Number,Object,Array,String,Boolean,Infinity,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('disabled');storage.set(k,v);}},navigator:{},window:{}};context.window=context;vm.createContext(context);for(const name of ['data','store','battle-data','battle-tracks','battle-ai','battle-engine','battle-store'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),context);return context;}
const c=env(),D=c.BattleData,A=c.BattleAI,E=c.BattleEngine;
for(const track of ['sprint','fork','loop'])for(const p of Object.values(D.profiles)){
 const original=JSON.stringify(p),ai=D.opponents(track,p),r=E.create(track,[p,...ai],1,'weak');
 assert.equal(JSON.stringify(r.cars[0].profile.stats),JSON.stringify(p.stats));
 for(const car of r.cars.slice(1)){const base=D.get(car.profile.id);assert.deepEqual(Array.from(car.profile.stats),Array.from(base.stats,x=>x-2));assert.ok(car.profile.stats.every(x=>x>=58&&x<=98));assert.ok(D.budgets[car.profile.rarity]<=D.budgets[p.rarity]);}
 assert.ok(E.valid(r));assert.equal(JSON.stringify(p),original);
}
for(const track of ['sprint','fork','loop']){const p={...D.trial,stats:[60,60,60,60,60]},r=E.create(track,[p,p,p],1,'floor');while(r.status==='running')E.step(r);assert.ok(r.cars.every(x=>x.finish!==null));assert.ok(E.valid(r));}
const old=E.create('sprint',[D.trial,D.trial,D.trial],1,'old');old.version=6;old.cars.slice(1).forEach(car=>{car.profile={...D.trial,stats:[...D.trial.stats]};car.boost=60;});const stats=JSON.stringify(old.cars[0].profile.stats);E.upgrade(old);assert.equal(old.version,9);assert.equal(JSON.stringify(old.cars[0].profile.stats),stats);assert.ok(E.valid(old));const once=JSON.stringify(old);E.upgrade(old);assert.equal(JSON.stringify(old),once);
console.log('PASS 2082 matches: exact AI-only -2, no double penalty, original cards preserved, tier cap, lowest stats finish and legacy migration');

const legacy=E.create('loop',[D.trial,D.trial,D.trial],2,'minus10');legacy.version=7;legacy.cars.slice(1).forEach(car=>{car.profile={...D.trial,stats:D.trial.stats.map(x=>x-10),aiPenalty:10};car.boost=50;car.cooldown=0;});E.upgrade(legacy);assert.equal(legacy.version,9);for(const car of legacy.cars.slice(1))assert.deepEqual(Array.from(car.profile.stats),Array.from(D.trial.stats,x=>x-2));assert.ok(E.valid(legacy));const saved=JSON.stringify(legacy);E.upgrade(legacy);assert.equal(JSON.stringify(legacy),saved);console.log('PASS old -10 becomes -2 exactly once');

const oldThree=E.create('sprint',[D.trial,D.trial,D.trial],1,'minus3');oldThree.version=8;oldThree.cars.slice(1).forEach(car=>{car.profile={...D.trial,stats:D.trial.stats.map(x=>x-3),aiPenalty:3};car.cooldown=40;});E.upgrade(oldThree);assert.equal(oldThree.version,9);for(const car of oldThree.cars.slice(1))assert.deepEqual(Array.from(car.profile.stats),Array.from(D.trial.stats,x=>x-2));assert.ok(E.valid(oldThree));const savedThree=JSON.stringify(oldThree);E.upgrade(oldThree);assert.equal(JSON.stringify(oldThree),savedThree);console.log('PASS old -3 becomes -2 exactly once');
