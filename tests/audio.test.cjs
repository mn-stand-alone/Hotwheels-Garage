const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function environment(saved=null,fail=false){
 const listeners={},intervals=new Set(),contexts=[];
 const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),threshold:param(),ratio:param(),connect(n){return n;},disconnect(){},start(){},stop(){this.onended?.();}});
 class AudioContext{constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=8000;this.destination=node();contexts.push(this);}async resume(){this.state='running';}async suspend(){this.state='suspended';}createMediaElementSource(){return node();}createGain(){return node();}createOscillator(){return node();}createBiquadFilter(){return node();}createBufferSource(){return node();}createDynamicsCompressor(){return node();}createAnalyser(){return {...node(),getByteTimeDomainData(a){a.fill(128);}};}createBuffer(channels,length,rate){const data=new Float32Array(length);return {duration:length/rate,getChannelData:()=>data};}}
 const document={hidden:false,readyState:'loading',getElementById:()=>null,addEventListener:(name,fn)=>listeners[name]=fn};
 class Audio{constructor(){this.paused=true;this.currentTime=0;}addEventListener(){}load(){this.currentTime=0;}pause(){this.paused=true;}async play(){this.paused=false;}}
 const context={Audio,document,location:{pathname:'/battle.html'},AudioContext,localStorage:{getItem:()=>saved,setItem(){if(fail)throw Error('blocked');}},setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn),addEventListener:(name,fn)=>listeners[name]=fn};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('js/audio.js','utf8'),context);return {audio:context.GameAudio,document,listeners,intervals,contexts};
}
(async()=>{
 const e=environment();assert.equal(e.audio.status().state,'locked');assert.equal(e.contexts.length,0);e.audio.sfx('nitro');assert.equal(e.audio.status().events,0);
 await e.audio.unlock();await e.audio.unlock();assert.equal(e.contexts.length,1);assert.equal(e.intervals.size,0);assert.equal(e.audio.status().musicPlaying,true);
 assert.equal(e.audio.status().musicFile,'home.m4a');e.audio.setMode('race-loop');await Promise.resolve();await Promise.resolve();assert.equal(e.audio.status().musicFile,'loop.m4a');e.audio.drive(40,true,true);assert.equal(e.audio.status().engine,true);e.audio.update({effects:false});assert.equal(e.audio.status().engine,false);const n=e.audio.status().events;e.audio.sfx('nitro');assert.equal(e.audio.status().events,n);
 e.audio.update({effects:true,music:false});for(const name of ['click','select','detail','charge','reveal','countdown','go','nitro','ready','collision','win','finish','intro'])e.audio.sfx(name,'legend');assert.ok(e.audio.status().events>n);
 e.audio.update({muted:true});e.audio.drive(50,true,true);assert.equal(e.audio.status().engine,false);
 e.audio.update({muted:false});e.audio.drive(40,false,true);e.document.hidden=true;e.listeners.visibilitychange();assert.equal(e.audio.status().state,'suspended');assert.equal(e.audio.status().musicPlaying,false);assert.equal(e.audio.status().voices,0);assert.equal(e.audio.status().engine,false);assert.equal(e.intervals.size,0);
 e.document.hidden=false;await e.audio.unlock();assert.equal(e.intervals.size,0);e.listeners.pagehide();assert.equal(e.intervals.size,0);
 const corrupt=environment('{broken',true);corrupt.audio.update({musicVolume:20,effectsVolume:-5,music:'yes'});assert.equal(corrupt.audio.getSettings().musicVolume,1);assert.equal(corrupt.audio.getSettings().effectsVolume,0);assert.equal(corrupt.audio.getSettings().music,true);
 console.log('PASS audio: gesture gating, single context, local playlist switching, effects, engine, mute, background cleanup, restart, corrupt/blocked storage');
})().catch(e=>{console.error(e);process.exitCode=1;});
