const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const e={window:{}};vm.createContext(e);vm.runInContext(fs.readFileSync('js/battle-tracks.js','utf8'),e);const T=e.window.BattleTracks;
const report=[];
for(const [id,expected] of Object.entries({sprint:2900,fork:2500,loop:2600})){
 assert.equal(T.tracks[id].length,expected);
 let distance=0,previous=T.frame(id,0),min=Infinity,pair;const points=[];
 for(let s=0;s<=expected;s++){
  const p=T.frame(id,s);assert.ok([p.x,p.y,p.z,...p.up,...p.right,...p.forward].every(Number.isFinite));
  const delta=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z);if(s)assert.ok(delta>.99&&delta<1.01,`${id} distance discontinuity at ${s}`);
  distance+=delta;previous=p;
  for(const lane of [-4.8,0,4.8]){const q=T.frame(id,s,lane);assert.ok(Math.abs(Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z)-Math.abs(lane))<1e-6);if(s){const prev=T.frame(id,s-1,lane),advance=[q.x-prev.x,q.y-prev.y,q.z-prev.z];assert.ok(advance.reduce((n,v,i)=>n+v*p.forward[i],0)>.75,`${id} lane folds at ${s}`);}}
  if(s%2===0)points.push({...p,s});
 }
 assert.ok(Math.abs(distance-expected)<.1);
 // Non-neighbouring cross sections: two road + car envelopes (8m each),
 // plus the 2m sampling gap. >18m guarantees disjoint envelopes here.
 for(let i=0;i<points.length;i++)for(let j=i+16;j<points.length;j++){
  const a=points[i],b=points[j],d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  if(d<min){min=d;pair=[a.s,b.s];}assert.ok(d>18,`${id}: road/car envelopes overlap at ${a.s}, ${b.s}`);
 }
 report.push({track:id,length:+distance.toFixed(3),minimumNonAdjacentClearance:+min.toFixed(3),pair});
}
for(const l of T.loopRanges){
 const a=T.frame('loop',l.start),b=T.frame('loop',l.end),top=T.frame('loop',(l.start+l.end)/2);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>30);assert.ok(top.up[1]<-.99);
 for(const boundary of [l.start,l.end]){const x=T.frame('loop',boundary-.01),y=T.frame('loop',boundary+.01);assert.ok(Math.hypot(x.x-y.x,x.y-y.y,x.z-y.z)<.021);assert.ok(x.forward.reduce((sum,v,i)=>sum+v*y.forward[i],0)>.999);}
}
console.log('PASS arc length, all lane surfaces, continuous frames, both loop joins, non-adjacent road/car clearance');console.log(JSON.stringify(report,null,2));
