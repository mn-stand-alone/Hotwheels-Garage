/* Local playlist excerpts for BGM; synthesized action effects remain independent. */
(function(){
  'use strict';
  if(window.GameAudio)return;
  const KEY='benben-audio-v1',defaults={muted:false,music:true,effects:true,musicVolume:.24,effectsVolume:.55};
  const clean=p=>({...defaults,...Object.fromEntries(Object.keys(defaults).map(k=>[k,typeof defaults[k]==='boolean'?typeof p?.[k]==='boolean'?p[k]:defaults[k]:Number.isFinite(p?.[k])?Math.max(0,Math.min(1,p[k])):defaults[k]]))});
  let settings;try{settings=clean(JSON.parse(localStorage.getItem(KEY)));}catch{settings={...defaults};}
  let ctx,musicBus,fxBus,engineBus,master,analyser,noiseBuffer,engine,unlocked=false,timer=null,next=0,beat=0,mode=location.pathname.includes('battle')?'lobby':location.pathname.includes('garage')?'garage':'home',lastCollision=-10,lastClick=-10;
  const voices=new Set();let notes=0,events=0;
  function gain(bus,value){if(ctx&&bus)bus.gain.setTargetAtTime(value,ctx.currentTime,.035);}
  function apply(){gain(master,settings.muted?0:.7);gain(musicBus,settings.music?settings.musicVolume:0);gain(fxBus,settings.effects?settings.effectsVolume:0);gain(engineBus,settings.effects?settings.effectsVolume*.25:0);}
  function track(source,nodes){voices.add(source);source.onended=()=>{voices.delete(source);for(const node of [source,...nodes])node.disconnect();};}
  function tone(freq,duration=.15,volume=.1,type='sine',bus=fxBus,at=ctx?.currentTime,end=freq){
    if(!ctx||voices.size>=100||duration<=0)return;
    const osc=ctx.createOscillator(),env=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(20,freq),at);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
    env.gain.setValueAtTime(0,at);env.gain.linearRampToValueAtTime(volume,at+.008);env.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(env).connect(bus);track(osc,[env]);osc.start(at);osc.stop(at+duration+.02);notes++;
  }
  function noise(duration,volume,freq=1200,at=ctx?.currentTime,end=freq,bus=fxBus){
    if(!ctx||voices.size>=100)return;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),env=ctx.createGain();source.buffer=noiseBuffer;source.loop=true;filter.type='bandpass';filter.Q.value=.65;filter.frequency.setValueAtTime(freq,at);filter.frequency.exponentialRampToValueAtTime(Math.max(30,end),at+duration);
    env.gain.setValueAtTime(.0001,at);env.gain.linearRampToValueAtTime(volume,at+.02);env.gain.exponentialRampToValueAtTime(.0001,at+duration);source.connect(filter).connect(env).connect(bus);track(source,[filter,env]);source.start(at);source.stop(at+duration+.02);
  }
  function ready(){return ctx&&ctx.state==='running'&&unlocked&&!document.hidden&&!settings.muted;}
  function sfx(name,detail){
    if(!ready()||!settings.effects)return;
    const t=ctx.currentTime;events++;
    if(name==='click'){if(t-lastClick<.045)return;lastClick=t;noise(.035,.035,950);tone(310,.035,.025,'sine');}
    else if(name==='select'){instrument('keys',64,t,.08,.16,0,fxBus);}
    else if(name==='detail'){[60,64,67].forEach((n,i)=>instrument('keys',n,t+i*.035,.055,.35,0,fxBus));}
    else if(name==='charge'){tone(90,.8,.045,'sine',fxBus,t,180);noise(.85,.09,300,t,1400);}
    else if(name==='reveal'){
      const rank=['common','rare','epic','legend'].indexOf(detail),scale=[0,4,7,12,16,19];
      scale.slice(0,Math.max(3,rank+3)).forEach((n,i)=>instrument('keys',60+n,t+i*.085,.095,.9,0,fxBus));
      if(rank>=2){noise(.25,.06,1600);tone(110,.5,.07,'sine');}
    }
    else if(name==='countdown')tone(440,.10,.07,'sine');
    else if(name==='go'){tone(880,.22,.09,'sine');noise(.16,.055,1200);}
    else if(name==='nitro'){noise(.65,.19,350,t,1800);noise(.35,.06,1800,t+.15,500);tone(65,.35,.09,'sine',fxBus,t,110);}
    else if(name==='ready'){instrument('keys',72,t,.07,.2,0,fxBus);instrument('keys',76,t+.09,.055,.3,0,fxBus);}
    else if(name==='collision'){if(t-lastCollision<.18)return;lastCollision=t;noise(.15,.18,500,t,100);tone(85,.14,.12,'sine',fxBus,t,40);}
    else if(name==='win'||name==='finish'){
      (name==='win'?[0,4,7,12,7,12,16]:[0,3,7,12]).forEach((n,i)=>instrument('keys',60+n,t+i*.12,.1,.85,0,fxBus));
    }else if(name==='intro'){noise(.55,.12,220,t,1000);tone(55,.65,.08,'triangle',fxBus,t,160);}
  }
  // Original 32-bar funk arrangements; cached instrument samples avoid per-frame synthesis.
  const samples=new Map(),musicVoices=new Set();
  const tracks={home:{title:'大厅 · 律动启程',file:'home.m4a'},garage:{title:'车库 · 悠闲巡游',file:'garage.m4a'},race:{title:'滨海天际线 · 海岸节拍',file:'sprint.m4a'},'race-sprint':{title:'滨海天际线 · 海岸节拍',file:'sprint.m4a'},'race-fork':{title:'恐龙丛林 · 强劲脉冲',file:'fork.m4a'},'race-loop':{title:'海上巨环 · 高空疾驰',file:'loop.m4a'}};
  const song=()=>tracks[mode]||tracks.home;
  let media=null,mediaFile='',mediaError='',playPending=false;
  function syncMusic(){
    if(!ready()||!settings.music){media?.pause();return;}
    if(!media){media=new window.Audio();media.loop=true;media.preload='metadata';ctx.createMediaElementSource(media).connect(musicBus);
      media.addEventListener('error',()=>{mediaError='音乐文件加载失败，请通过 start-game.cmd 启动后重试';showState();});}
    if(mediaFile!==song().file){media.pause();mediaFile=song().file;mediaError='';media.src=(location.pathname.includes('/tests/')?'../assets/audio/':'assets/audio/')+mediaFile;media.load();}
    if(media.paused&&!playPending){playPending=true;const requested=mediaFile;
      Promise.resolve(media.play()).then(()=>{if(requested===mediaFile){mediaError='';showState();}if(!ready()||!settings.music)media.pause();}).catch(e=>{if(e.name!=='AbortError'&&requested===mediaFile){mediaError='点击页面重试播放音乐';showState();}}).finally(()=>{playPending=false;if(requested!==mediaFile)syncMusic();});}
  }
  function instrument(kind,midi,at,velocity=1,duration=.3,pan=0,bus=musicBus){
    if(!ctx||voices.size>=100)return;
    const key=kind+':'+midi;
    if(!samples.has(key)){
      const length=kind==='keys'?2.4:kind==='guitar'?.5:kind==='bass'?.8:kind==='hat'?.15:.65;
      const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate),data=buffer.getChannelData(0),f=440*2**((midi-69)/12);
      let seed=321,prev=0;
      for(let i=0;i<data.length;i++){
        const t=i/ctx.sampleRate,w=2*Math.PI*f*t;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const n=seed/2147483648-1,high=n-prev;prev=n;let v=0;
        if(kind==='bass')v=(Math.sin(w)+.32*Math.sin(2*w)*Math.exp(-t*8)+.12*Math.sin(3*w)*Math.exp(-t*20))*Math.exp(-t*4)*(1-Math.exp(-t*500));
        if(kind==='keys')v=(Math.sin(w+1.4*Math.sin(2*w)*Math.exp(-t*12))+.12*Math.sin(3*w)*Math.exp(-t*4))*Math.exp(-t*2.7)*(1-Math.exp(-t*180));
        if(kind==='guitar')v=(Math.sin(w)+.45*Math.sin(2*w)+.2*Math.sin(3*w)+.09*Math.sin(5*w))*Math.exp(-t*17)*(1-Math.exp(-t*700));
        if(kind==='kick')v=Math.sin(2*Math.PI*(49*t+70*.022*(1-Math.exp(-t/.022))))*Math.exp(-t*12)+n*.06*Math.exp(-t*220);
        if(kind==='snare')v=(.42*n*Math.exp(-t*22)+.38*Math.sin(2*Math.PI*185*t)*Math.exp(-t*28))*(1-Math.exp(-t*1200));
        if(kind==='hat')v=high*.22*Math.exp(-t*65)*(1-Math.exp(-t*1500));
        data[i]=v*Math.min(1,(length-t)*80);
      }
      samples.set(key,buffer);
    }
    const source=ctx.createBufferSource(),env=ctx.createGain();source.buffer=samples.get(key);
    const end=Math.min(duration,source.buffer.duration||duration),nodes=[env];
    env.gain.setValueAtTime(velocity,at);env.gain.setValueAtTime(velocity,at+Math.max(.005,end-.04));env.gain.linearRampToValueAtTime(0,at+end);
    source.connect(env);
    if(ctx.createStereoPanner){const stereo=ctx.createStereoPanner();stereo.pan.value=pan;env.connect(stereo).connect(bus);nodes.push(stereo);}else env.connect(bus);
    track(source,nodes);if(bus===musicBus)musicVoices.add(source);
    const ended=source.onended;source.onended=()=>{musicVoices.delete(source);ended();};source.start(at);source.stop(at+end+.01);notes++;
  }
  function startScheduler(){syncMusic();}
  function stopEngine(){if(!engine)return;for(const osc of engine.oscs){try{osc.stop();}catch{}osc.disconnect();}engine.filter.disconnect();engine.gain.disconnect();engine=null;}
  function stop(){media?.pause();if(timer!==null){clearInterval(timer);timer=null;}for(const source of [...voices]){try{source.stop();}catch{}}stopEngine();}
  async function unlock(){
    if(document.hidden)return;
    try{
      if(!ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){showState('此浏览器不支持音频');return;}
        ctx=new Audio();master=ctx.createGain();musicBus=ctx.createGain();fxBus=ctx.createGain();engineBus=ctx.createGain();analyser=ctx.createAnalyser();analyser.fftSize=256;
        const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=8;musicBus.connect(master);
        fxBus.connect(master);engineBus.connect(master);master.connect(limiter).connect(analyser).connect(ctx.destination);
        noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const values=noiseBuffer.getChannelData(0);let seed=67;for(let i=0;i<values.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values[i]=seed/2147483648-1;}apply();
      }
      await ctx.resume();if(document.hidden){stop();await ctx.suspend();return;}unlocked=ctx.state==='running';if(unlocked)startScheduler();showState();
    }catch{showState('点击重试启用声音');}
  }
  function drive(speed=0,boosting=false,active=false){
    if(!ready()||!settings.effects||!active){stopEngine();return;}
    if(!engine){const filter=ctx.createBiquadFilter(),level=ctx.createGain();filter.type='lowpass';filter.frequency.value=650;level.gain.value=.13;filter.connect(level).connect(engineBus);
      const oscs=[1,2.01,3.98].map(mult=>{const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=45*mult;osc.connect(filter);osc.start();return osc;});engine={oscs,filter,gain:level};}
    const gear=Math.floor(speed/14),rpm=42+(speed%14)*4+gear*5;engine.oscs.forEach((o,i)=>o.frequency.setTargetAtTime(rpm*[1,2.01,3.98][i],ctx.currentTime,.09));engine.filter.frequency.setTargetAtTime(300+speed*6+(boosting?180:0),ctx.currentTime,.12);
  }
  function setMode(value){if(mode===value)return;for(const source of [...musicVoices]){try{source.stop();}catch{}}mode=value;beat=0;if(ctx)next=ctx.currentTime+.04;syncMusic();showState();}
  function update(value){settings=clean({...settings,...value});try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}apply();if(!settings.effects||settings.muted)stopEngine();syncMusic();showState();}
  function showState(message){const playing=document.getElementById('audioTrack');if(playing)playing.textContent=song().title;const label=document.getElementById('audioState');if(label)label.textContent=message||mediaError||(settings.muted?'已静音':unlocked?'声音已启用':'点击任意位置启用声音');const button=document.getElementById('audioMute');if(button){button.textContent=settings.muted?'开启全部声音':'全部静音';button.setAttribute('aria-pressed',String(settings.muted));}}
  function controls(){
    const panel=document.createElement('details');panel.className='audio-panel';panel.innerHTML='<summary>♫ 声音设置</summary><div class="audio-controls"><small id="audioTrack"></small><small id="audioState" aria-live="polite"></small><button id="audioMute" type="button"></button><label><input id="audioMusic" type="checkbox">背景音乐</label><label>音乐音量<input id="audioMusicVolume" type="range" min="0" max="100" step="1"></label><label><input id="audioEffects" type="checkbox">游戏音效</label><label>音效音量<input id="audioEffectsVolume" type="range" min="0" max="100" step="1"></label></div>';document.body.append(panel);
    document.getElementById('audioMute').onclick=()=>{update({muted:!settings.muted});unlock();};
    for(const [id,key] of [['audioMusic','music'],['audioEffects','effects']]){const el=document.getElementById(id);el.checked=settings[key];el.onchange=()=>{update({[key]:el.checked});unlock();};}
    for(const [id,key] of [['audioMusicVolume','musicVolume'],['audioEffectsVolume','effectsVolume']]){const el=document.getElementById(id);el.value=settings[key]*100;el.oninput=()=>update({[key]:+el.value/100});}
    showState();
  }
  document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',e=>{if(!e.repeat)unlock();});
  document.addEventListener('click',e=>{if(!e.target.closest('.audio-panel')&&e.target.closest('button,a,summary'))sfx('click');});
  document.addEventListener('change',e=>{if(e.target.matches('select')&&!e.target.closest('.audio-panel'))sfx('select');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();ctx?.suspend().catch(()=>{});}else if(unlocked)unlock();});
  window.addEventListener('pagehide',()=>{stop();ctx?.suspend().catch(()=>{});});window.addEventListener('pageshow',()=>{if(unlocked&&!document.hidden)unlock();});
  window.GameAudio={unlock,sfx,drive,setMode,update,getSettings:()=>({...settings}),status:()=>{let rms=0;if(analyser){const a=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(a);rms=Math.sqrt(a.reduce((s,v)=>s+((v-128)/128)**2,0)/a.length);}return {state:ctx?.state||'locked',voices:voices.size,engine:Boolean(engine),notes,events,rms,mode,track:song().title,musicFile:mediaFile,musicPlaying:Boolean(media&&!media.paused),musicTime:media?.currentTime||0,musicError:mediaError,samples:samples.size};}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',controls,{once:true});else controls();
})();
