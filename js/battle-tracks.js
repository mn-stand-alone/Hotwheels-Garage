(function () {
  const tracks = {
    sprint: { id: 'sprint', name: '滨海天际线', subtitle: 'THRILL CITY / 城市高架', label: '01 / THRILL CITY', reference: 'Thrill City', length: 2900, elevation: 26, color: '#ff963d', desc: '驶上橙色跨海高架，在玻璃楼群与蓝色海湾之间全速冲刺。', focus: '高速 S 弯 · 极速 / 加速', icon: '↗', difficulty: '起伏高速弯' },
    fork: { id: 'fork', name: '恐龙丛林', subtitle: 'JURASSIC JUNGLE / 丛林山路', label: '02 / JURASSIC JUNGLE', reference: 'Jurassic Jungle', length: 2500, elevation: 23, color: '#54dcca', desc: '穿越热带岛屿与机械霸王龙地标，沿连续蛇形山路与起伏坡道争夺领先。', focus: '连续弯道 · 操控 / 重量', icon: '⋈', difficulty: '蛇形山路' },
    loop: { id: 'loop', name: '海上巨环', subtitle: 'HYPERLOOP / 垂直回环', label: '03 / HYPERLOOP', reference: 'Hyperloop', length: 2600, elevation: 28, color: '#bfa1ff', desc: '冲上碧海上空的双重错位橙色回环，倒悬驶过顶点，再向岛岸终点冲刺。', focus: '立体回环 · 操控 / 氮气', icon: '∞', difficulty: '立体回环' },
  };
  // Raw routes are resampled by arc length: simulation metres equal road metres.
  // Each loop moves sideways by 36m, so entry and exit never share a deck.
  const loops=[{start:400,r:45},{start:1350,r:55}];
  const tau=Math.PI*2;
  function raw(id,u){
    if(id!=='loop'){
      const scale=id==='fork'?110:190, amp=id==='fork'?42:58;
      return {x:amp*(1-Math.cos(u/scale))+14*Math.pow(Math.sin(u/70),3),
        y:tracks[id].elevation+9*(1-Math.cos(u/155))+4*(1-Math.cos(u/65)),z:u,angle:0};
    }
    let x=0,z=u;
    for(const l of loops){
      const n=tau*l.r;
      if(u>=l.start+n){x+=36;z-=n;continue;}
      if(u>=l.start){const a=(u-l.start)/l.r;
        return {x:x+36*(a-Math.sin(a))/tau,y:tracks.loop.elevation+l.r*(1-Math.cos(a)),z:z-(u-l.start)+l.r*Math.sin(a),angle:a};}
      break;
    }
    // Road connectors use smooth hills/chicanes with zero slope at loop joins.
    const previous=loops.filter(l=>u>=l.start+tau*l.r).at(-1);
    const next=loops.find(l=>u<l.start);
    const start=previous?previous.start+tau*previous.r:0,end=next?next.start:tracks.loop.length;
    const t=(u-start)/(end-start),wave=Math.sin(Math.PI*t);
    return {x:x+30*wave*wave*Math.sin(t*tau),y:tracks.loop.elevation+14*wave*wave,z,angle:0};
  }
  const tables={};
  for(const id of Object.keys(tracks)){
    const points=[],dist=[0],length=tracks[id].length;
    let total=0,prev=raw(id,0);points.push(prev);
    for(let u=1;u<=length;u++){const p=raw(id,u);total+=Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z);points.push(p);dist.push(total);prev=p;}
    tables[id]={points,dist,scale:length/total};
  }
  function center(id,s){
    const t=tables[id],length=tracks[id].length;
    if(s<0||s>length){const edge=s<0?0:length,f=center(id,edge),near=center(id,edge+(s<0?.1:-.1));
      const d=[f.x-near.x,f.y-near.y,f.z-near.z],n=Math.hypot(...d),extra=Math.abs(s-edge);
      return {...f,x:f.x+d[0]/n*extra,y:f.y+d[1]/n*extra,z:f.z+d[2]/n*extra};}
    const target=s/t.scale;let lo=0,hi=t.dist.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(t.dist[mid]<=target)lo=mid;else hi=mid;}
    const k=(target-t.dist[lo])/(t.dist[hi]-t.dist[lo]),u=lo+k,p=raw(id,u);
    return {x:p.x*t.scale,y:tracks[id].elevation+(p.y-tracks[id].elevation)*t.scale,z:p.z*t.scale,angle:p.angle,u};
  }
  const normalize=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function frame(id,s,lane=0){
    const f=center(id,s),a=center(id,s-.05),b=center(id,s+.05);
    const forward=normalize([b.x-a.x,b.y-a.y,b.z-a.z]);
    const right0=normalize(cross([0,Math.cos(f.angle),-Math.sin(f.angle)],forward));
    const up0=cross(forward,right0);
    const fade=Math.min(1,Math.max(0,s/100),Math.max(0,(tracks[id].length-s)/100));
    const bank=id==='loop'?0:(id==='fork'?.24:.38)*Math.sin(f.u/(id==='fork'?110:190))*fade;
    const right=right0.map((v,i)=>v*Math.cos(bank)+up0[i]*Math.sin(bank));
    const up=up0.map((v,i)=>v*Math.cos(bank)-right0[i]*Math.sin(bank));
    return {...f,x:f.x+lane*right[0],y:f.y+lane*right[1],z:f.z+lane*right[2],right,up,forward,bank};
  }
  const loopRanges=loops.map(l=>{const t=tables.loop;return {start:t.dist[l.start]*t.scale,end:(t.dist[Math.floor(l.start+tau*l.r)]+((l.start+tau*l.r)%1)*(t.dist[Math.ceil(l.start+tau*l.r)]-t.dist[Math.floor(l.start+tau*l.r)]))*t.scale,radius:l.r*t.scale};});
  function zone(id,s){
    if(id==='loop'&&loopRanges.some(l=>s>=l.start&&s<=l.end))return {name:'错位垂直回环',curve:1,boost:.68};
    if(s<150)return {name:'起步加速区',curve:0,boost:1};
    if(id==='fork')return {name:'连续蛇形山路',curve:.55,boost:.85};
    return {name:id==='loop'?'起伏连接弯':'滨海高速 S 弯',curve:id==='loop'?.15:.12,boost:1};
  }
  function lane(id,s,index,seed){
    // Keep lane changes on one continuous deck; never jump between branch meshes.
    return [-3.5,0,3.5][index];
  }
  window.BattleTracks={tracks,frame,zone,lane,loopRanges,loopStart:loopRanges[0].start,loopLength:loopRanges[0].end-loopRanges[0].start};
})();
