// Generate the explicit review backlog without changing source card data.
const fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};context.window=context;vm.createContext(context);
for(const file of ['data','battle-data'])vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),context);
const profiles=Object.values(context.BattleData.profiles);
const pending=context.CARDS.filter(c=>!context.BattleData.get(c.id).reviewed);
const result={rulesVersion:context.BattleData.version,total:profiles.length,reviewed:profiles.filter(p=>p.reviewed).length,
  byType:Object.fromEntries(Object.keys(context.BattleData.templates).map(t=>[t,profiles.filter(p=>p.type===t).length])),
  byBody:Object.fromEntries(Object.keys(context.BattleData.bodies).map(t=>[t,profiles.filter(p=>p.shape===t).length])),
  pending:pending.map(c=>({id:c.id,name:c.nameEn,batch:c.batch,assigned:context.BattleData.get(c.id).type,shape:context.BattleData.get(c.id).shape,stats:context.BattleData.get(c.id).stats}))};
fs.writeFileSync('assets/battle/vehicle-review.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({total:result.total,reviewed:result.reviewed,pending:pending.length,byType:result.byType,byBody:result.byBody,distinctRatings:new Set(profiles.map(p=>p.stats.join(','))).size}));
