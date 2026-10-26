import * as THREE from '../vendor/three/three.module.js';

// Original, procedural scenery. Reference images are not bundled game assets.
export function buildEnvironment(world,track) {
  const geometries={box:new THREE.BoxGeometry(1,1,1),ball:new THREE.SphereGeometry(1,16,10),rock:new THREE.IcosahedronGeometry(1,1),cylinder:new THREE.CylinderGeometry(1,1,1,9),cone:new THREE.ConeGeometry(1,1,8)};
  const batches=new Map(),matrix=new THREE.Matrix4(),quat=new THREE.Quaternion();
  const corridor=[];
  for(let s=0;s<=BattleTracks.tracks[track].length;s+=6)corridor.push(BattleTracks.frame(track,s));
  function obstructs(p,radius){return corridor.some(f=>Math.hypot(p[0]-f.x,p[1]-f.y,p[2]-f.z)<radius+13);}
  function item(shape,color,p,scale,rot=[0,0,0]){
    // Conservative sphere includes rotation, road half-width, vehicle height and sampling margin.
    const radius=Math.hypot(...scale)*(shape==='box'?.5:1);
    if(obstructs(p,radius))return;
    const key=shape+color;
    if(!batches.has(key))batches.set(key,{shape,color,items:[]});
    quat.setFromEuler(new THREE.Euler(...rot));matrix.compose(new THREE.Vector3(...p),quat,new THREE.Vector3(...scale));
    batches.get(key).items.push(matrix.clone());
  }
  let seed=track==='fork'?912:track==='loop'?411:73;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const waterMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`varying vec3 p; void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
    varying vec3 p;uniform float time;
    void main(){
      float dx=0.,dz=0.;
      for(int i=0;i<5;i++){float k=float(i)+1.;float f=.025*pow(2.,k);float phase=(p.x*cos(k*2.4)+p.z*sin(k*2.4))*f+time*(.4+k*.18);dx+=cos(phase)*cos(k*2.4)*.045;dz+=cos(phase)*sin(k*2.4)*.045;}
      vec3 n=normalize(vec3(-dx,1.,-dz)),v=normalize(cameraPosition-p);
      float fresnel=.04+.8*pow(1.-max(dot(n,v),0.),4.);
      vec3 sky=vec3(.55,.78,.87),sea=vec3(.015,.30,.36);
      float sparkle=pow(max(dot(n,normalize(v+normalize(vec3(-.45,.85,-.35)))),0.),180.);
      vec3 color=mix(sea,sky,fresnel)+sparkle*vec3(.8,.7,.45);
      gl_FragColor=vec4(color,1.);
    }`});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000),waterMaterial);water.rotation.x=-Math.PI/2;water.position.set(0,-12,650);world.add(water);
  function island(x,z,sx,sz,h=10){
    // Continuous terrain: irregular shoreline, sandy shelf and vegetated interior.
    const g=new THREE.PlaneGeometry(sx*2.4,sz*2.4,52,52);g.rotateX(-Math.PI/2);
    const positions=g.attributes.position,colors=[];
    for(let i=0;i<positions.count;i++){
      const px=positions.getX(i),pz=positions.getZ(i),a=Math.atan2(pz/sz,px/sx);
      const r=Math.hypot(px/sx,pz/sz)*(1+.075*Math.sin(a*5+x)+.04*Math.cos(a*9+z));
      const noise=Math.sin(px*.095+z)*Math.cos(pz*.073+x)+.4*Math.sin(px*.24+pz*.17);
      const y=-13+Math.max(0,1-r*r)*(h+16)+Math.max(0,1-r)*noise*3;
      positions.setY(i,y);
      const color=new THREE.Color(y<-.5?0xd6c397:y<3?0x87965c:0x355a34);
      color.multiplyScalar(.88+.12*(noise+1)/2);colors.push(color.r,color.g,color.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const terrain=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94}));terrain.position.set(x,0,z);terrain.receiveShadow=true;world.add(terrain);
  }
  function palm(x,y,z,size=1){
    if(obstructs([x,y+7*size,z],9*size))return;
    item('cylinder',0x9e7c49,[x,y+5*size,z],[.32*size,10*size,.32*size],[0,0,.1]);
    for(let k=0;k<7;k++){const a=k*Math.PI*2/7;for(let j=0;j<4;j++){
      const r=(j+1)*1.15*size;
      item('ball',k%2?0x285638:0x437841,[x+Math.cos(a)*r,y+(10.7-j*j*.18)*size,z+Math.sin(a)*r],[1.7*size,.09*size,(.65-j*.11)*size],[0,-a,-.12-j*.14]);
    }}
  }
  function jungle(x,z,sx,sz,count){
    island(x,z,sx,sz,12);
    for(let i=0;i<count;i++){const a=rand()*6.28,r=Math.sqrt(rand());const px=x+Math.cos(a)*r*sx*.72,pz=z+Math.sin(a)*r*sz*.72;
      const py=5+Math.sqrt(1-r*r)*4;const size=.7+rand()*.8;
      if(obstructs([px,py+8*size,pz],10*size))continue;
      if(i%3===0)palm(px,py,pz,size);
      else{item('cylinder',0x6f6343,[px,py+4,pz],[.5,8,.5]);item('rock',i%2?0x317557:0x4a905c,[px,py+10*size,pz],[4.5*size,6*size,4.5*size]);}
    }
  }
  // Coastline, rocky outcrops and tropical vegetation form actual 3D silhouettes.
  if(track==='sprint'){
    for(let i=0;i<14;i++){const z=60+i*210;island(-145,z,100,140,10);island(150,z+80,110,130,8);
      for(let j=0;j<5;j++){
        const side=j%2?-1:1,x=side*(75+rand()*110),bz=z+(rand()-.5)*150,w=12+rand()*15,d=12+rand()*18,h=28+rand()*90;
        if(obstructs([x,h/2+6,bz],Math.hypot(w+4,h+8,d+4)/2))continue;
        item('box',j%2?0x85b1bf:0xb0cbd1,[x,h/2+6,bz],[w,h,d]);
        item('box',0xe6e5d9,[x,h+7,bz],[w+1,2,d+1]);
        // Windows are instanced bars; no per-window draw calls.
        for(let floor=8;floor<h-3;floor+=6){item('box',0x46798d,[x,6+floor,bz-d/2-.12],[w-1,1.7,.3]);item('box',0x46798d,[x-w/2-.12,6+floor,bz],[.3,1.7,d-1]);}
        for(let k=0;k<3;k++)item('box',0xdbe4dd,[x-w/2+(k+1)*w/4,h/2+6,bz-d/2-.4],[.45,h,.4]);
      }
      for(let k=0;k<8;k++)palm((k%2?-1:1)*(50+rand()*40),6,z+rand()*100,.8+rand()*.4);
    }
  }else if(track==='fork'){
    for(let i=0;i<17;i++)jungle(i%2?95:-100,i*155+20,100,115,65);
    for(let i=0;i<24;i++)item('rock',i%2?0x93906a:0x8f9975,[(i%2?1:-1)*(50+rand()*70),4+rand()*14,i*110],[16+rand()*18,22+rand()*25,18+rand()*12]);
  }else{
    for(let i=0;i<12;i++)jungle((i%2?1:-1)*(125+rand()*70),i*155-40,65+rand()*30,95,9);
    for(let i=0;i<9;i++)item('rock',0xb4aa8d,[i%2?100:-115,-2+rand()*5,200+i*70],[20+rand()*20,25+rand()*40,22]);
    // Monumental blue support towers frame the 90 m vertical loop.
    for(const z of [355,445]){item('box',0x1679b4,[-11,42,z],[3,108,3]);item('box',0x2f9bcf,[-11,95,z],[5,2,5]);}
    item('box',0x1876ac,[-11,95,400],[3,3,92]);
  }
  // Sea-facing cliffs and offshore islands visible beyond the immediate track.
  for(let i=0;i<12;i++){const side=i%2?1:-1;island(side*(350+rand()*300),i*145-100,70+rand()*100,80+rand()*90,20+rand()*25);}
  // Puffy clouds, balloons and colorful festival pennants add scale without textures.
  for(let i=0;i<18;i++){
    const x=(rand()-.5)*1500,z=rand()*2100-200,y=160+rand()*100;
    for(let j=0;j<3;j++)item('ball',0xfff8e6,[x+j*15,y+(j===1?6:0),z],[24+j*3,8+j*2,12+j*2]);
  }
  for(let i=0;i<5;i++){
    const x=(i%2?1:-1)*(100+rand()*100),z=100+i*240,y=95+rand()*65;
    item('ball',i%2?0xffad2b:0x249ad5,[x,y,z],[7,10,7]);item('box',0x8b593a,[x,y-15,z],[3,2,3]);
    for(const side of [-1,1])item('cylinder',0xe4d9b1,[x+side*1.5,y-11,z],[.12,8,.12]);
  }
  for(const b of batches.values()){
    const mat=new THREE.MeshStandardMaterial({color:b.color,roughness:.85,metalness:0});
    const mesh=new THREE.InstancedMesh(geometries[b.shape],mat,b.items.length);
    b.items.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();world.add(mesh);
  }
  const animated=[];
  if(track==='fork'){
    for(const z of [205,655,1040,1630,2110])animated.push(makeDinosaur(world,-75,z));
  }
  return {water:waterMaterial,animated};
}

function makeDinosaur(world,x,z){
  const dino=new THREE.Group();dino.position.set(x,0,z);world.add(dino);
  const mats={skin:new THREE.MeshStandardMaterial({color:0x3b8f79,roughness:.55,metalness:.25}),dark:new THREE.MeshStandardMaterial({color:0x255b56}),joint:new THREE.MeshStandardMaterial({color:0xffb23b,metalness:.4,roughness:.4}),teeth:new THREE.MeshStandardMaterial({color:0xfff3cb}),eye:new THREE.MeshBasicMaterial({color:0xffdf31})};
  function part(geo,mat,pos,scale,rot=0,parent=dino){const m=new THREE.Mesh(geo,mats[mat]);m.position.set(...pos);m.scale.set(...scale);m.rotation.z=rot;parent.add(m);return m;}
  const sphere=new THREE.IcosahedronGeometry(1,1),cube=new THREE.BoxGeometry(1,1,1),cone=new THREE.ConeGeometry(1,1,7);
  part(sphere,'skin',[0,17,0],[10,14,9],-.28);part(sphere,'skin',[9,29,0],[7,11,7],-.45);
  part(cube,'skin',[20,36,0],[17,7,10]);part(cube,'dark',[25,32,0],[14,1.3,8]);
  const jaw=new THREE.Group();jaw.position.set(14,28,0);dino.add(jaw);part(cube,'skin',[8,0,0],[18,3,8],0,jaw);
  for(const side of [-1,1]){
    part(sphere,'skin',[-3,7,side*6],[4,9,3],.18);part(cube,'dark',[1,1,side*6],[11,3,5]);
    part(sphere,'joint',[0,13,side*8],[2.4,2.4,1]);
    part(cube,'skin',[10,21,side*8],[9,2,2],-.5);
    part(sphere,'eye',[22,38,side*5.1],[1.4,1.4,.5]);part(sphere,'dark',[22.4,38,side*5.45],[.6,.8,.2]);
    for(let i=0;i<6;i++){part(cone,'teeth',[18+i*2,30.7,side*3.6],[.6,2.5,.6],Math.PI);part(cone,'teeth',[3+i*2,2.2,side*3.2],[.5,2.2,.5],0,jaw);}
  }
  for(let i=0;i<5;i++)part(sphere,'skin',[-9-i*5,16-i*2,0],[8-i,5-i*.7,5-i*.7],.4);
  for(let i=0;i<6;i++)part(cone,'joint',[-7+i*2,29+i*.8,0],[1.3,3,1.3],-.3);
  return jaw;
}
