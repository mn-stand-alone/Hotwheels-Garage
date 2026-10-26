import * as THREE from '../vendor/three/three.module.js';
import { buildEnvironment } from './battle-environment.js?v=tracks-20261026';

export class BattleScene {
  constructor(host, onLost, onRestored) {
    this.host=host; this.effects=true; this.track=null; this.cars=[]; this.lastCamera=null;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setClearColor(0x9bdcf0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.05;
    host.prepend(this.renderer.domElement);
    this.nitroOverlay=document.createElement('div');this.nitroOverlay.className='nitro-vignette';this.nitroOverlay.setAttribute('aria-hidden','true');host.append(this.nitroOverlay);
    this.renderer.domElement.setAttribute('aria-label','三辆自动驾驶赛车的实时 3D 比赛场景');
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onLost();});
    this.renderer.domElement.addEventListener('webglcontextrestored',onRestored);
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xb4dfe9,450,1700);
    const sky=new THREE.Mesh(new THREE.SphereGeometry(6000,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;void main(){float h=normalize(v).y;vec3 c=mix(vec3(.75,.91,.95),vec3(.15,.53,.84),pow(max(0.,h),.5));gl_FragColor=vec4(c,1.);}'}));this.scene.add(sky);
    this.scene.add(new THREE.HemisphereLight(0xf4fcff,0x526451,.9));
    const sun=new THREE.DirectionalLight(0xfff0d2,2.7);sun.position.set(-45,90,-25);this.scene.add(sun);
    this.sun=sun;sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:230});
    sun.shadow.bias=-.0003;sun.shadow.normalBias=.08;this.scene.add(sun.target);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.camera=new THREE.PerspectiveCamera(58,1,.1,9000);
    const pmrem=new THREE.PMREMGenerator(this.renderer);this.skyReflection=pmrem.fromScene(this.scene,0);this.scene.environment=this.skyReflection.texture;this.scene.environmentIntensity=.4;pmrem.dispose();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  }
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  quality(low){this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.5));this.renderer.shadowMap.enabled=!low;this.resize();}
  material(color,metalness=.1){return new THREE.MeshPhysicalMaterial({color,roughness:.4,metalness,clearcoat:.35,clearcoatRoughness:.2});}
  box(parent,w,h,d,color,x=0,y=0,z=0){
    let geo=new THREE.BoxGeometry(w,h,d);
    if(parent.userData.body&&Math.min(w,h,d)>.15){
      geo.dispose();const bevel=Math.min(.12,Math.min(w,h,d)*.2),shape=new THREE.Shape();
      shape.moveTo(-w/2+bevel,-h/2+bevel);shape.lineTo(w/2-bevel,-h/2+bevel);shape.lineTo(w/2-bevel,h/2-bevel);shape.lineTo(-w/2+bevel,h/2-bevel);shape.closePath();
      geo=new THREE.ExtrudeGeometry(shape,{depth:d-bevel*2,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,steps:1});geo.translate(0,0,-d/2+bevel);geo.computeVertexNormals();
    }
    const m=new THREE.Mesh(geo,this.material(color));m.position.set(x,y,z);parent.add(m);return m;
  }
  clear(){if(!this.world)return;this.scene.remove(this.world);this.world.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.map?.dispose();m.bumpMap?.dispose();m.dispose();}}});}
  build(track,profiles){
    this.clear();this.track=track;this.world=new THREE.Group();this.scene.add(this.world);this.cars=[];this.lastCamera=null;
    const t=BattleTracks.tracks[track];
    this.environment=buildEnvironment(this.world,track);
    const bands=[{lane:0,width:12}];
    for(const band of bands){
      this.ribbon(-35,t.length+70,band.lane,band.width,-.38,0x125e9b);
      this.ribbon(-35,t.length+70,band.lane,band.width,0,0xff620e);
      for(const side of [-1,1]){
        const ranges=[[-35,t.length+70]];
        for(const [start,end] of ranges){
          this.wall(start,end,band.lane,side*band.width/2,0xF04A07);
          this.ribbon(start,end,band.lane,.35,1.15,0xffa13b,side*band.width/2);
        }
        this.ribbon(-35,t.length+70,band.lane,.13,.035,0xd94709,side*(band.width/2-.65));
      }
    }
    const joints=[];
    for(let d=0;d<t.length;d+=14)for(const band of bands){
      const f=BattleTracks.frame(track,d,band.lane);
      for(const side of [-1,1]){const p=this.surfacePoint(f,side*(band.width/2-.25),.035);joints.push(...p);}
    }
    const seams=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(joints,3)),new THREE.LineBasicMaterial({color:0xd84d10}));this.world.add(seams);
    for(let d=0;d<t.length;d+=70){
      if(track==='loop'&&BattleTracks.zone(track,d).curve===1)continue;
      for(const band of bands){const f=BattleTracks.frame(track,d,band.lane);
        const p=this.surfacePoint(f,0,-1.05),beam=this.box(this.world,band.width+1,1.1,2.2,0x187ac0,...p);
        beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.right),new THREE.Vector3(...f.up),new THREE.Vector3(...f.forward)));
        for(const side of [-1,1]){const q=this.surfacePoint(f,side*(band.width/2-.6),-1.2);this.box(this.world,1.2,q[1]+12,1.5,0x1776b5,q[0],(q[1]-12)/2,q[2]);}
      }
    }
    if(track==='sprint'){
      this.scenicLoop(-220,36,470,45);this.scenicLoop(-220,25,1050,33);
      for(let d=0;d<220;d+=3){const f=BattleTracks.frame(track,d);for(const side of [-1,1]){const curb=this.box(this.world,.55,.06,2.85,Math.floor(d/3)%2?0xa6a9a4:0x4c5252,...this.surfacePoint(f,side*5.7,.06));curb.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.right),new THREE.Vector3(...f.up),new THREE.Vector3(...f.forward)));}}
    }
    this.gate(0,'START',0xffcb41);this.gate(t.length,'FINISH',0xffcb41);
    // Observed Goliath connectors (04:08 / 05:08): cyan decks and yellow rails.
    for(const [start,end] of [[350,385],track==='fork'?[1180,1220]:[t.length-105,t.length-60]]){
      this.ribbon(start,end,0,12,.045,0x55b8cd);
      for(const side of [-1,1])this.ribbon(start,end,0,.42,1.22,0xf5d12e,side*6);
      this.checkpoint(start+4);
    }
    this.festival(t.length);
    profiles.forEach((p,i)=>this.cars.push(this.car(p,i)));
    this.world.traverse(o=>{if(o.isMesh&&!o.material?.isShaderMaterial){o.receiveShadow=true;o.castShadow=true;}});
    this.renderer.compile(this.scene,this.camera);
  }
  surfacePoint(f,lateral,height){return [f.x+f.right[0]*lateral+f.up[0]*height,f.y+f.right[1]*lateral+f.up[1]*height,f.z+f.right[2]*lateral+f.up[2]*height];}
  routeGroup(s){
    const f=BattleTracks.frame(this.track,s),group=new THREE.Group();group.position.set(f.x,f.y,f.z);
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.right),new THREE.Vector3(...f.up),new THREE.Vector3(...f.forward)));this.world.add(group);return group;
  }
  checkpoint(s){
    const group=this.routeGroup(s);
    for(const side of [-1,1]){
      this.box(group,.12,7,.12,0xe8eee2,side*6.8,3.5,0);
      this.box(group,1.15,5.5,.05,0xa5d92c,side*7.4,4.3,0);
      const flag=this.label('CHECKPOINT','#b5ee31',512);flag.position.set(side*7.4,5,0);flag.scale.set(3.2,.4,1);group.add(flag);
    }
  }
  festival(s){
    const group=this.routeGroup(s);
    for(const side of [-1,1]){
      // Tiered stands, canopies and steel frames keep the finish readable at speed.
      this.box(group,18,1,52,0x637b85,side*18,-2,-15);
      for(const z of [-38,8])for(const x of [11,25])this.box(group,2,42,2,0x486d80,side*x,-23,z);
      for(let row=0;row<5;row++){
        this.box(group,3,.6,38,0x354657,side*(13+row*2),row*.9-1,-15);
        for(let seat=0;seat<16;seat++)this.box(group,.7,.6,.7,seat%3===0?0xe55f36:0x338cb8,side*(13+row*2),row*.9-.3,-32+seat*2.1);
      }
      this.box(group,14,.35,43,0xf2f0e7,side*18,8,-15);
      for(const dz of [-35,5])for(const dx of [12,24])this.box(group,.2,10,.2,0xd8dfe0,side*dx,3,dz);
      for(let j=0;j<5;j++){
        const banner=this.box(group,1.6,5,.12,j%2?0xf5d740:0x3b9bc4,side*(9+j*.2),3,-55+j*9);banner.rotation.z=side*-.15;
      }
      this.box(group,16,10,15,0xd4dad5,side*28,3,26);
      this.box(group,16.3,.5,15.3,0x2a6275,side*28,8.2,26);
    }
    this.box(group,19,1.3,1.8,0x253b65,0,10,-3);
    const label=this.label('ISLAND FESTIVAL','#ffb837',512);label.scale.set(14,1.75,1);label.position.set(0,10,-4);group.add(label);
  }
  ribbon(start,end,lane,width,height,color,offset=0){
    const verts=[],indices=[];let n=0;
    for(let s=start;s<=end+2;s+=2){const f=BattleTracks.frame(this.track,Math.min(s,end),lane);
      for(const side of [-1,1])verts.push(...this.surfacePoint(f,offset+side*width/2,height));
      if(n){const k=n*2;indices.push(k-2,k-1,k,k-1,k+1,k);}n++;
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();
    const uv=[];for(let i=0;i<n;i++){uv.push(0,i/8,1,i/8);}g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#929292';ctx.fillRect(0,0,128,128);
    for(let i=0;i<1200;i++){const k=(i*73)%128,j=(i*47+Math.floor(i/128)*13)%128;ctx.fillStyle=i%2?'#a0a0a0':'#888888';ctx.fillRect(k,j,1,1);}
    const grain=new THREE.CanvasTexture(canvas);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    const mat=new THREE.MeshPhysicalMaterial({color,roughness:.31,metalness:.08,clearcoat:.65,clearcoatRoughness:.25,bumpMap:grain,bumpScale:.018,side:THREE.DoubleSide});this.world.add(new THREE.Mesh(g,mat));
  }
  wall(start,end,lane,offset,color){
    const vertices=[],indices=[];let n=0;
    for(let d=start;d<=end+2;d+=2){const f=BattleTracks.frame(this.track,Math.min(d,end),lane);
      for(const height of [-.35,1.15])vertices.push(...this.surfacePoint(f,offset,height));
      if(n){const k=n*2;indices.push(k-2,k-1,k,k-1,k+1,k);}n++;
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const m=this.material(color);m.side=THREE.DoubleSide;this.world.add(new THREE.Mesh(g,m));
  }
  scenicLoop(x,y,z,radius){
    const v=[],indices=[];
    for(let i=0;i<=120;i++){const a=i/120*Math.PI*2;for(const side of [-1,1])v.push(x+side*4,y+radius*(1-Math.cos(a)),z+radius*Math.sin(a));if(i){const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();const mat=this.material(0xff620e);mat.side=THREE.DoubleSide;this.world.add(new THREE.Mesh(g,mat));
    for(const side of [-1,1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.5,6,96),this.material(0xffb53d));ring.rotation.y=Math.PI/2;ring.position.set(x+side*4,y+radius,z);this.world.add(ring);this.box(this.world,2,y+radius,2,0x1479ba,x+side*5,(y+radius)/2-8,z);}
  }
  label(text,color='#fff',width=256){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=64;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#141b28';ctx.fillRect(0,0,width,64);ctx.fillStyle=color;let size=34;ctx.font=`bold ${size}px sans-serif`;while(ctx.measureText(text).width>width-20&&size>14){ctx.font=`bold ${--size}px sans-serif`;}ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,34,width-16);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false}));
  }
  gate(s,text,color){
    const f=BattleTracks.frame(this.track,s),gate=new THREE.Group();gate.position.set(f.x,f.y,f.z);gate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.right),new THREE.Vector3(...f.up),new THREE.Vector3(...f.forward)));this.world.add(gate);
    this.box(gate,1.15,10,1.1,0x146db3,-7,5,0);this.box(gate,1.15,10,1.1,0x146db3,7,5,0);
    this.box(gate,15.1,2,.9,0x1475b9,0,10,0);this.box(gate,15.3,.22,1,color,0,11.1,0);
    for(const side of [-1,1]){this.box(gate,2,1.2,2,0x14497f,side*7,.3,0);this.box(gate,.3,7,.3,color,side*7,5,-.65);}
    const label=this.label(text,'#ffffff');label.position.set(0,10,-.5);label.scale.set(9.5,2.35,1);gate.add(label);
    for(let x=-6;x<6;x++)for(let z=0;z<2;z++)this.box(gate,1,.035,1,(x+z)%2?0xfff5db:0x242c35,x+.5,.055,z);
  }
  car(p,index){
    const root=new THREE.Group(),body=new THREE.Group();body.userData.body=true;root.add(body);this.world.add(root);
    const aliases={truck:'pickup',compact:'hatch',coupe:'sedan'};
    const shape=aliases[p.shape]||p.shape||'sedan';const truck=shape==='pickup'||shape==='offroad',compact=shape==='hatch',sport=shape==='sport';
    const width=truck?2.25:compact?1.8:2, length=shape==='pickup'?5:shape==='sedan'?4.7:compact?3.5:4.3;
    const color=index===0?p.color:index===1?'#57d8cc':'#bba1ff';
    const loft=(rings,material)=>{
      const vertices=[],indices=[];
      for(const [z,w,bottom,top] of rings){for(const [x,y] of [[-w*.8,bottom],[-w,bottom+.13],[-w*.92,top-.08],[-w*.66,top],[w*.66,top],[w*.92,top-.08],[w,bottom+.13],[w*.8,bottom]])vertices.push(x,y,z);}
      for(let ring=1;ring<rings.length;ring++)for(let j=0;j<8;j++){const a=(ring-1)*8+j,b=(ring-1)*8+(j+1)%8,c=ring*8+j,d=ring*8+(j+1)%8;indices.push(a,c,b,b,c,d);}
      for(let j=1;j<7;j++){indices.push(0,j+1,j);const k=(rings.length-1)*8;indices.push(k,k+j,k+j+1);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,material);body.add(mesh);return mesh;
    };
    loft([[-length*.5,width*.43,.37,.85],[-length*.36,width*.5,.32,1.02],[0,width*.48,.32,.96],[length*.34,width*.5,.32,.82],[length*.5,width*.4,.38,.65]],new THREE.MeshPhysicalMaterial({color,metalness:.42,roughness:.24,clearcoat:1,clearcoatRoughness:.16,side:THREE.DoubleSide}));
    const roof=truck?1.95:compact?1.7:shape==='sedan'?1.65:1.4;
    const glass=new THREE.MeshPhysicalMaterial({color:0x172d3c,metalness:.55,roughness:.14,clearcoat:1,side:THREE.DoubleSide});
    if(shape==='convertible'){
      glass.dispose();this.box(body,width*.72,.08,length*.42,0x17222b,0,1.01,-.25);
      for(const x of [-.42,.42]){this.box(body,.55,.38,.55,0x8c382b,x,1.17,-.35);this.box(body,.55,.6,.14,0x943e2f,x,1.36,-.64);}
      const wind=this.box(body,width*.75,.65,.07,0x366379,0,1.27,.58);wind.rotation.x=-.32;
      this.box(body,width*.8,.07,.09,color,0,1.61,.48);
    }else if(shape==='pickup'){
      this.box(body,width*.8,.08,length*.42,0x222d34,0,1.04,-1.1);
      for(const side of [-1,1])this.box(body,.17,.4,length*.43,color,side*width*.44,1.15,-1.1);
      loft([[-.25,width*.4,.92,roof],[.8,width*.37,.86,roof],[1.3,width*.38,.85,1.05]],glass);
      this.box(body,width*.75,.1,1.1,color,0,roof,.25);
    }else{
      const rear=shape==='offroad'||compact?-.42:-.35,roofRear=shape==='offroad'||compact?-.35:-.18;
      loft([[length*rear,width*.36,.87,compact||truck?roof-.12:.96],[length*roofRear,width*.34,.88,roof],[length*.09,width*.32,.87,roof],[length*.3,width*.35,.8,.9]],glass);
      this.box(body,width*.64,.09,length*(truck||compact?.44:.25),color,0,roof,truck||compact?-.45:-length*.05);
      if(shape==='sedan')for(const side of [-1,1]){this.box(body,.055,.62,.12,color,side*width*.34,1.23,-.15);for(const z of [-.65,.65])this.box(body,.055,.055,.23,0xc9d0d1,side*width*.47,.96,z);}
      if(shape==='offroad'){
        for(const x of [-.7,.7])this.box(body,.1,.16,2.4,0x22262b,x,roof+.15,-.3);
        for(const z of [-1.2,.3])this.box(body,1.5,.1,.1,0x22262b,0,roof+.25,z);
        const spare=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.25,20),this.material(0x171b1c));spare.rotation.x=Math.PI/2;spare.position.set(0,1.12,-length/2-.15);body.add(spare);
      }
      if(shape==='concept')for(const side of [-1,1]){const fin=this.box(body,.12,.65,1.9,color,side*.9,1.16,-.8);fin.rotation.z=side*.2;}
    }
    this.box(body,.3,.02,length*.43,0xffeec8,0,1,1.15);
    this.box(body,width+.1,.16,.2,0x101520,0,.55,length/2);
    for(const side of [-1,1]){
      this.box(body,.5,.15,.08,0xffefb0,side*width*.32,.8,length/2+.02);
      this.box(body,.4,.13,.08,0xf73831,side*width*.32,.75,-length/2-.02);
    }
    this.box(body,width*.8,.09,.07,0xb92327,0,.78,-length/2-.035);
    this.box(body,.5,.17,.055,0xe1e7e3,0,.52,-length/2-.04);
    for(const side of [-1,1])this.box(body,.28,.14,.18,0x252b30,side*.55,.38,-length/2);
    if(sport||shape==='muscle'){this.box(body,width+.25,.14,.5,color,0,1.2,-1.8);for(const side of [-1,1])this.box(body,.1,.5,.1,0x151a20,side*.6,.95,-1.8);}
    const wheels=[];
    for(const x of [-1,1])for(const z of [-1,1]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(truck?.48:.38,truck?.48:.38,.32,12),this.material(0x15181d));wheel.rotation.z=Math.PI/2;wheel.position.set(x*width/2,.4,z*length*.32);body.add(wheel);wheels.push(wheel);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.34,8),this.material(0xbcc8d1,.6));hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);body.add(hub);
    }
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.48,3,8),new THREE.MeshBasicMaterial({color:0x65daff,transparent:true,opacity:.85}));flame.rotation.x=-Math.PI/2;flame.position.set(0,.6,-length/2-1.3);body.add(flame);
    const tag=this.label(p.name,index===0?'#ffd36a':color,512);tag.position.y=2.6;tag.scale.set(3.5,.44,1);root.add(tag);
    const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(72),3));
    const particles=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:0x70dbff,size:.18,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));body.add(particles);particles.frustumCulled=false;
    const jets=new THREE.Group();body.add(jets);
    for(const side of [-1,1]){
      const jet=new THREE.Mesh(new THREE.ConeGeometry(.3,3.8,20),new THREE.MeshBasicMaterial({color:0x408bff,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));jet.rotation.x=-Math.PI/2;jet.position.set(side*.55,.5,-length/2-1.8);jets.add(jet);
      const core=new THREE.Mesh(new THREE.ConeGeometry(.14,2.5,16),new THREE.MeshBasicMaterial({color:0xe9ffff,blending:THREE.AdditiveBlending,depthWrite:false}));core.rotation.x=-Math.PI/2;core.position.set(side*.55,.5,-length/2-1.2);jets.add(core);
    }
    const rings=[];for(let j=0;j<3;j++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.6,.035,6,40),new THREE.MeshBasicMaterial({color:0x59e7ff,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));jets.add(ring);rings.push(ring);}
    const glow=new THREE.PointLight(0x45baff,0,9,2);glow.position.set(0,.7,-length/2-.3);body.add(glow);
    return {root,body,wheels,flame,tag,particles,jets,rings,glow,length};
  }
  render(r,alpha=1,preview=false){
    if(!r||!this.cars.length)return;
    r.cars.forEach((c,i)=>{
      const s=c.prevS+(c.s-c.prevS)*alpha,lane=c.prevLane+(c.lane-c.prevLane)*alpha,f=BattleTracks.frame(r.track,s,lane),car=this.cars[i];
      car.root.position.fromArray(this.surfacePoint(f,0,.12));
      car.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.right),new THREE.Vector3(...f.up),new THREE.Vector3(...f.forward)));
      car.tag.position.set(0,2.6,0);
      car.wheels.forEach(w=>{w.rotation.set(0,0,Math.PI/2);w.rotateY(s*2.6);});
      car.flame.visible=c.boost>0;car.flame.scale.setScalar(this.effects?1+.1*Math.sin(r.tick*.8):1);
      car.body.rotation.z=this.effects&&c.hitUntil>r.tick ? Math.sin(r.tick*2)*.05:0;
      car.body.position.y=this.effects?.015*Math.sin(s*3):0;
      car.flame.scale.y=c.boost>0?1.5+.2*Math.sin(r.tick*1.7):1;
      car.jets.visible=this.effects&&c.boost>0;car.glow.intensity=car.jets.visible?12:0;
      if(car.jets.visible){car.jets.scale.z=1+.12*Math.sin(r.tick*1.5);car.rings.forEach((ring,j)=>{const age=(r.tick/18+j/3)%1;ring.position.set(0,.55,-car.length/2-age*7);ring.scale.setScalar(.5+age*1.8);ring.material.opacity=(1-age)*.7;});}
      car.particles.visible=this.effects&&(c.boost>0||c.hitUntil>r.tick);
      if(car.particles.visible){
        const hit=c.hitUntil>r.tick,positions=car.particles.geometry.attributes.position;car.particles.material.color.setHex(hit?0xffc15a:0x70dbff);
        for(let j=0;j<24;j++){const age=((r.tick*.06+j*.137)%1),a=j*2.4;positions.setXYZ(j,Math.sin(a)*age*(hit?2:.5),.5+Math.cos(a)*age*.35,-2-age*(hit?3:7));}positions.needsUpdate=true;
      }
    });
    const player=this.cars[0].root.position;
    // Track-local chase rig follows the car through the entire loop, including inversion.
    const c=r.cars[0],s=c.prevS+(c.s-c.prevS)*alpha,lane=c.prevLane+(c.lane-c.prevLane)*alpha;
    this.nitroOverlay.classList.toggle('active',this.effects&&c.boost>0);
    const f=BattleTracks.frame(r.track,s,lane);
    const forward=new THREE.Vector3(...f.forward),up=new THREE.Vector3(...f.up);
    const now=performance.now(),dt=Math.min(.05,(now-(this.cameraTime||now-16))/1000);this.cameraTime=now;
    const smooth=1-Math.exp(-dt*14),distance=c.boost>0&&this.effects?9.5:8;
    const desired=player.clone().addScaledVector(forward,-distance).addScaledVector(up,2.6);
    const target=player.clone().addScaledVector(forward,18).addScaledVector(up,1.1);
    if(!this.lastCamera){this.camera.position.copy(desired);this.lookTarget=target;}
    else {this.camera.position.lerp(desired,smooth);this.lookTarget.lerp(target,smooth);}
    this.camera.up.copy(up);this.camera.lookAt(this.lookTarget);this.lastCamera=true;
    const fov=c.boost>0&&this.effects?72:62;this.camera.fov+=(fov-this.camera.fov)*smooth;this.camera.updateProjectionMatrix();
    this.sun.position.copy(player).add(new THREE.Vector3(-45,85,-35));this.sun.target.position.copy(player);
    if(this.environment){this.environment.water.uniforms.time.value=this.effects?performance.now()/1000:0;this.environment.animated.forEach((jaw,i)=>jaw.rotation.z=this.effects?Math.sin(performance.now()/900+i)*.09:0);}
    this.renderer.render(this.scene,this.camera);
  }
}
