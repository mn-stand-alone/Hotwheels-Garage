const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function env(fail=false){const storage=new Map();const context={console,Date,Math,JSON,Number,Object,Array,String,Boolean,Infinity,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('disabled');storage.set(k,v);}},navigator:{},window:{}};context.window=context;vm.createContext(context);for(const name of ['data','store','battle-data','battle-tracks','battle-ai','battle-engine','battle-store'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),context);return context;}
const c=env(),S=c.Store,B=c.BattleStore,id=c.CARDS[0].id,other=c.CARDS[1].id;
assert.equal(S.favoriteCards().length,0);
assert.throws(()=>S.setFavorite(id,true));
S.update(s=>s.owned[id]=Date.now());
assert.equal(S.favoriteCards().length,0);
S.setFavorite(id,true);S.setFavorite(id,true);
assert.equal(S.favoriteCards().length,1);
const backup=S.exportJSON();S.setFavorite(id,false);assert.ok(S.isOwned(id));
S.importJSON(backup);assert.ok(S.isFavorite(id));
for(const favorites of [[other],[id,id],null]){const bad=JSON.parse(backup);bad.favorites=favorites;assert.throws(()=>S.importJSON(JSON.stringify(bad)));assert.equal(S.exportJSON(),backup);}
const make=p=>c.BattleEngine.create('sprint',[p,...c.BattleData.opponents('sprint')],1,'favorite-race');
assert.throws(()=>B.start(make(c.BattleData.trial)));assert.equal(B.remaining(),3);
S.setFavorite(id,false);assert.throws(()=>B.start(make(c.BattleData.get(id))));assert.equal(B.remaining(),3);
S.setFavorite(id,true);const race=make(c.BattleData.get(id));B.start(race);S.setFavorite(id,false);B.checkpoint(race);B.settle(race,true);assert.equal(B.remaining(),2);assert.equal(B.remaining('sprint'),0);
S.update(s=>{delete s.battle.daily.version;s.battle.daily.used=5;s.battle.daily.ids=['a','b','c','d','e'];s.battle.history=s.battle.daily.ids.map(id=>({...s.battle.history[0],id}));delete s.battle.daily.tracks;});
assert.equal(B.remaining(),2);assert.equal(B.read().daily.used,1);assert.equal(B.remaining('sprint'),0);
const bad=B.read();bad.daily.used=5;assert.equal(B.valid(bad),false);
S.update(s=>s.battle.daily.date='2000-01-01');assert.equal(B.remaining(),3);
const legacy=JSON.parse(backup);delete legacy.favorites;S.importJSON(JSON.stringify(legacy));assert.equal(S.favoriteCards().length,0);assert.ok(S.isOwned(id));
console.log('PASS favorites persistence, import validation, start guard, active continuation, legacy migration and daily reset');
