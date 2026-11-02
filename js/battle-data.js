/* Arcade ratings: explicit overrides plus transparent name/body classification. */
(function () {
  const templates = {
    speed: { name: '极速型', stats: [90, 65, 62, 68, 65], shape: 'sport' },
    launch: { name: '加速型', stats: [72, 90, 65, 68, 55], shape: 'muscle' },
    handling: { name: '操控型', stats: [65, 73, 92, 70, 50], shape: 'compact' },
    balanced: { name: '均衡型', stats: [70, 70, 70, 70, 70], shape: 'coupe' },
    impact: { name: '冲撞型', stats: [62, 52, 62, 84, 90], shape: 'truck' },
  };
  const groups = {
    speed: ['Ford GT40', 'Ford GT', 'McLaren W1', 'McLaren Speedtail', '2020 Koenigsegg Jesko', 'Bugatti Bolide', 'Ferrari F40 Competizione', 'Pagani Utopia', 'Mazda 787B', '2016 Ford GT Race'],
    launch: ["'67 Camaro", "'10 Camaro SS", 'Tesla Model S Plaid', 'DeLorean Alpha5', "'15 Dodge Charger SRT", "'20 Dodge Charger Hellcat", 'Porsche Taycan Turbo S', 'Ford Mustang GTD'],
    handling: ['Mazda MX-5 Miata', "'15 Mazda MX-5 Miata", 'Subaru BRZ', 'Toyota GR86 Cup', 'Porsche 911 GT3', 'Porsche 911 GT3 RS', 'Lotus Sport Elise', 'Toyota AE86 Sprinter Trueno', 'Subaru Impreza WRX', 'Ford RS200'],
    impact: ['2020 Ram 1500 Rebel', "'23 Ram 1500", 'Humvee', "'70 Dodge Power Wagon", '1988 Jeep Wagoneer', "'17 Ford F-150 Raptor", 'Land Rover Defender 90', "'20 Jeep Gladiator", "'67 Chevy C10", 'Mercedes-Benz Unimog 1300L'],
    balanced: ['RRRoadster', 'Rodger Dodger', 'Glory Chaser', 'BMW 2002', 'Datsun 240Z', 'Nissan Skyline GT-R (BNR32)'],
  };
  const exact = Object.fromEntries(Object.entries(groups).flatMap(([type, names]) => names.map(n => [n.toLowerCase().trim(), type])));
  function hash(text) { let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
  const bodies={
    sedan:{name:'轿车',type:'balanced',stats:[73,72,69,76,60]},
    convertible:{name:'敞篷车',type:'handling',stats:[74,78,81,65,52]},
    sport:{name:'跑车',type:'speed',stats:[91,79,73,59,48]},
    offroad:{name:'越野车',type:'impact',stats:[59,55,66,82,88]},
    pickup:{name:'皮卡',type:'impact',stats:[62,52,62,84,90]},
    hatch:{name:'两厢车',type:'handling',stats:[62,79,88,72,49]},
    muscle:{name:'肌肉车',type:'launch',stats:[84,85,56,64,61]},
    concept:{name:'概念车',type:'balanced',stats:[76,72,70,69,63]},
  };
  function classify(name){
    if(/roadster|spyder|spider|cabrio|convertible|miata|mx-5|s2000|敞篷/i.test(name))return 'convertible';
    if(/f-?150|ram 1500|silverado|c10|power wagon|gladiator|pickup|pick-up|tacoma|hilux|lolux|el camino|maverick|repu|sunny truck|皮卡/i.test(name))return 'pickup';
    if(/jeep|defender|land rover|range rover|humvee|bronco|unimog|suv|4[×x]4|off.?road|wagoneer|blazer|越野|悍马|牧马人|揽胜|怪物卡车/i.test(name))return 'offroad';
    if(/camaro|charger|challenger|mustang|barracuda|gto|chevelle|野马|科迈罗/i.test(name))return 'muscle';
    if(/civic|golf|mini cooper|fiesta|focus|yaris|clio|fiat 500|cupra|chevette|两厢|高尔夫|飞度/i.test(name))return 'hatch';
    if(/mclaren|ferrari|lamborghini|porsche|bugatti|koenigsegg|pagani|lotus|corvette|ford gt|gt40|supra|nsx|rx-7|787b|brz|gr86|f-type|aston martin|maserati|gordon murray|hypercar|跑车|超跑|兰博基尼|法拉利|帕加尼/i.test(name))return 'sport';
    if(/sedan|model s|model 3|taycan|bmw|mercedes|bentley|audi|skyline|impreza|accord|camry|cadillac|buick|jaguar mk|ford escort|chevy|datsun|轿车|宝马|奔驰|宾利|轿跑|老爷车|旅行车/i.test(name))return 'sedan';
    return 'concept';
  }
  const namesByModel={};
  for(const c of window.CARDS||[]){const key=(c.nameEn||c.cardName||c.id).trim().toLowerCase();namesByModel[key]=(namesByModel[key]||key)+' '+(c.nameZh||'');}
  const budgets={common:360,rare:390,epic:420,legend:450};
  // Weighted, capped allocation: adding rarity points never lowers an attribute.
  function allocate(base,total){
    const stats=Array(5).fill(60),weights=base.map(v=>Math.max(1,v-35));
    for(let points=total-300;points>0;points--){let best=-1;
      for(let i=0;i<5;i++)if(stats[i]<100&&(best<0||weights[i]/(stats[i]-59)>weights[best]/(stats[best]-59)))best=i;
      stats[best]++;
    }return stats;
  }
  function profile(card) {
    const key = (card.nameEn || card.cardName || card.id).trim().toLowerCase();
    let shape=classify(namesByModel[key]||key);
    if(shape==='concept'&&exact[key])shape={speed:'sport',launch:'muscle',handling:'sport',impact:'offroad',balanced:'concept'}[exact[key]];
    const type=exact[key]||bodies[shape].type;
    const stats=[...(exact[key]?templates[type].stats:bodies[shape].stats)];
    // Stable per-model trade-offs; same model and all its paint/batch cards stay equal.
    for(let i=0;i<5;i++){const j=(i+1)%5,delta=hash(key+':'+i)%11-5;if(stats[i]+delta>=40&&stats[i]+delta<=98&&stats[j]-delta>=40&&stats[j]-delta<=98){stats[i]+=delta;stats[j]-=delta;}}
    return { id: card.id, name: card.nameZh || card.nameEn || card.cardName || card.id, type, shape,
      stats:allocate(stats,budgets[card.rarity]||360), rarity:card.rarity, reviewed: Boolean(exact[key]), source:exact[key]?'车型定位覆盖':'名称规则估算', color: ['#ff652b', '#ffca45', '#ef4f6b', '#4fd2be', '#a498ff'][hash(key) % 5] };
  }
  const trial = { id: 'trial', name: '车库体验 GT', type: 'balanced', shape: 'sport', stats: allocate(templates.balanced.stats,360), reviewed: true, color: '#ff652b' };
  const profiles = Object.fromEntries((window.CARDS || []).map(c => [c.id, profile(c)]));
  window.BattleData = { version: 3, budgets, allocate, bodies, classify, templates, profiles, profile, trial, hash, labels: ['速度', '加速', '操控', '氮气', '重量'],
    get: id => profiles[id] || trial,
    opponents(track,player=trial) { return BattleAI.match(track,player); },
    statsHTML(p) { return `<div class="performance">${p.stats.map((v,i) => `<div><span>${this.labels[i]}</span><meter min="0" max="100" value="${v}">${v}</meter><b>${v}</b></div>`).join('')}</div>`; },
  };
})();
