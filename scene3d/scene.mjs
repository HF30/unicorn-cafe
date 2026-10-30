import * as T from './vendor/three-r170.mjs';
import models from './models.mjs';

// Art pass 1: candy-pastel toon look. 3-step toon shading, soft dark-plum inverted-hull outlines
// (constant on screen), chibi characters with named joints, sparkles, steam and twinkling lights.
const PLUM='#5e3d5c',OUTLINE_PX=2.6;
const gradient=(()=>{const t=new T.DataTexture(new Uint8Array([105,190,255]),3,1,T.RedFormat);t.minFilter=t.magFilter=T.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;})();
const toon=(color,extra={})=>new T.MeshToonMaterial({color,gradientMap:gradient,...extra});
// Colours (sRGB hex of a primitive's baked vertex colour) that read as paint, not form: no outline.
const NO_OUTLINE=new Set(['#ffffff','#ff9fb6','#7a5a9a','#6cc4f2','#e38aa8','#ffc1a8','#fff0a6']);
const hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(255*(v>.0031308?1.055*v**(1/2.4)-.055:12.92*v)).toString(16).padStart(2,'0')).join('');

// Embedded, palette-baked GLB meshes. No runtime resource loader or network API.
export function unpack(encoded){
 const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const dv=new DataView(bytes.buffer),len=dv.getUint32(12,true);
 const g=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+len))),offset=28+len;
 const read=i=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];const C=a.componentType===5126?Float32Array:Uint32Array;return new C(bytes.buffer,offset+(v.byteOffset||0)+(a.byteOffset||0),a.count*n);};
 const nodes=g.nodes.map(n=>{const group=new T.Group();group.name=n.name||'';
  if(n.matrix){group.matrix.fromArray(n.matrix);group.matrix.decompose(group.position,group.quaternion,group.scale);}else{if(n.translation)group.position.fromArray(n.translation);if(n.rotation)group.quaternion.fromArray(n.rotation);if(n.scale)group.scale.fromArray(n.scale);}
  if(n.mesh!==undefined)for(const p of g.meshes[n.mesh].primitives){const geo=new T.BufferGeometry();for(const [key,id] of Object.entries(p.attributes)){const k={POSITION:'position',NORMAL:'normal',COLOR_0:'color'}[key];if(k)geo.setAttribute(k,new T.BufferAttribute(read(id),3));}if(p.indices!==undefined)geo.setIndex(new T.BufferAttribute(read(p.indices),1));if(!geo.attributes.normal)geo.computeVertexNormals();
   const mesh=new T.Mesh(geo,new T.MeshToonMaterial({vertexColors:true,gradientMap:gradient,side:T.DoubleSide}));mesh.castShadow=mesh.receiveShadow=true;
   const col=geo.attributes.color;if(col&&NO_OUTLINE.has(hex({r:col.array[0],g:col.array[1],b:col.array[2]}))){mesh.userData.noOutline=true;mesh.castShadow=false;}
   group.add(mesh);}
  return group;
 });g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>nodes[i].add(nodes[c])));const root=new T.Group();g.scenes[g.scene||0].nodes.forEach(i=>root.add(nodes[i]));return root;
}

// Inverted hull: back faces pushed out along smoothed normals, a fixed number of screen pixels.
const outlinePx={value:new T.Vector3(.004,.005,0)};
const hullMat=new T.MeshBasicMaterial({color:PLUM,side:T.BackSide});
hullMat.onBeforeCompile=s=>{s.uniforms.uPx=outlinePx;s.vertexShader='attribute vec3 outlineNormal;\nuniform vec3 uPx;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n vec2 od=(projectionMatrix*vec4(normalize(normalMatrix*outlineNormal),0.)).xy;float ol=length(od);if(ol>1e-5)gl_Position.xy+=od/ol*uPx.xy*gl_Position.w;');};
hullMat.customProgramCacheKey=()=>'cafe-hull';
function smoothNormals(geo){
 if(geo.attributes.outlineNormal)return;const p=geo.attributes.position.array,n=geo.attributes.normal.array,acc=new Map(),key=i=>`${Math.round(p[i]*1e3)},${Math.round(p[i+1]*1e3)},${Math.round(p[i+2]*1e3)}`;
 for(let i=0;i<p.length;i+=3){const k=key(i),a=acc.get(k)||[0,0,0];a[0]+=n[i];a[1]+=n[i+1];a[2]+=n[i+2];acc.set(k,a);}
 const out=new Float32Array(p.length);for(let i=0;i<p.length;i+=3){const a=acc.get(key(i)),l=Math.hypot(...a)||1;out[i]=a[0]/l;out[i+1]=a[1]/l;out[i+2]=a[2]/l;}
 geo.setAttribute('outlineNormal',new T.BufferAttribute(out,3));
}
function addOutlines(root){const list=[];root.traverse(o=>{if(o.isMesh&&!o.userData.noOutline&&!o.userData.hull)list.push(o);});
 for(const m of list){smoothNormals(m.geometry);const h=new T.Mesh(m.geometry,hullMat);h.userData.hull=true;h.castShadow=h.receiveShadow=false;m.add(h);}}

// Soft star and puff sprites, drawn once on a canvas (no image files).
function spriteTex(kind){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
 if(kind==='star'){const g=x.createRadialGradient(32,32,0,32,32,30);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(32,32,30,0,7);x.fill();
  x.fillStyle='#ffffff';x.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?5:29;x.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r);}x.closePath();x.fill();}
 else{const g=x.createRadialGradient(32,32,0,32,32,31);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.55,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
function particles(count,size,tex,colors,blending=T.NormalBlending){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));
 const col=new Float32Array(count*4);for(let i=0;i<count;i++){const c=new T.Color(colors[i%colors.length]);col.set([c.r,c.g,c.b,1],i*4);}geo.setAttribute('color',new T.BufferAttribute(col,4));
 const p=new T.Points(geo,new T.PointsMaterial({size,map:tex,vertexColors:true,transparent:true,depthWrite:false,blending,sizeAttenuation:true}));p.frustumCulled=false;p.renderOrder=2;return p;}
const rnd=i=>{const s=Math.sin(i*127.1+311.7)*43758.5453;return s-Math.floor(s);};

export function createCafe(){
 const host=document.createElement('div');host.id='cafe3d';host.setAttribute('aria-hidden','true');document.body.prepend(host);
 let renderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch{host.remove();return null;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;host.append(renderer.domElement);
 const qs=new URLSearchParams(location.search),fixedT=qs.has('t')?+qs.get('t'):null,camQ=qs.get('cam');const scene=new T.Scene();scene.background=new T.Color('#f9e5d9');const camera=new T.PerspectiveCamera(38,1,.1,70);const home=new T.Vector3(8.3,6.1,10.8),look=new T.Vector3(0,1.65,0);camera.position.copy(home);camera.lookAt(look);if(camQ){const c=camQ.split(',').map(Number);home.set(c[0],c[1],c[2]);camera.position.copy(home);look.set(c[3],c[4],c[5]);camera.lookAt(look);}
 // Warm key light with soft, light shadows; a hemisphere fill keeps the shadow side pastel, not grey.
 scene.add(new T.HemisphereLight('#fff1f4','#d9c7e8',1.55));const sun=new T.DirectionalLight('#fff0d6',2.1);sun.position.set(-3,8,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.5,far:25});sun.shadow.bias=-.0006;sun.shadow.normalBias=.035;sun.shadow.radius=5;sun.shadow.intensity=.45;scene.add(sun);
 const fill=new T.DirectionalLight('#ffe3ef',.55);fill.position.set(7,4,9);scene.add(fill);
 const mesh=(geometry,color,pos,parent=scene)=>{const m=new T.Mesh(geometry,toon(color));m.position.set(...pos);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const box=(size,color,pos,parent)=>mesh(new T.BoxGeometry(...size),color,pos,parent);
 const ball=(size,color,pos,parent)=>mesh(new T.SphereGeometry(size,20,14),color,pos,parent);
 const prop=(key,height,pos,rotation=0)=>{const group=unpack(models[key]);const bound=new T.Box3().setFromObject(group),size=bound.getSize(new T.Vector3()),center=bound.getCenter(new T.Vector3());const scale=height/size.y;group.position.set(-center.x,-bound.min.y,-center.z);const holder=new T.Group();holder.add(group);holder.scale.setScalar(scale);holder.position.set(...pos);holder.rotation.y=rotation;scene.add(holder);return holder;};
 const part=(root,name)=>{let f=null;root.traverse(o=>{if(!f&&o.name===name)f=o;});const g=f||new T.Group();g.userData.rest=g.quaternion.clone();return g;};
 // Open-front room: mint window wall, lilac back wall, peach checkerboard floor.
 box([11,.18,8.5],'#f4d7ba',[0,-.12,0]);
 for(let x=0;x<11;x++)for(let z=0;z<8;z++)box([.99,.025,.99],(x+z)%2?'#f6d7d8':'#fff1dc',[x-5,.0,z-3.5]).userData.noOutline=true;
 box([11,5,.18],'#c9bdec',[0,2.4,-4.2]);box([.18,5,8.5],'#bfe6d6',[-5.5,2.4,0]);
 box([.12,3.1,4.5],'#fff0d9',[-5.37,2.7,-.7]);box([.13,2.8,4.2],'#a6e3ef',[-5.28,2.7,-.7]);
 for(const z of [-2.85,-.7,1.45])box([.18,2.9,.1],'#fff4d9',[-5.15,2.7,z]);box([.18,.1,4.3],'#fff4d9',[-5.15,2.7,-.7]);
 // Outdoor treetops visible through the window, entirely 3D.
 for(const z of [-2.3,.8]){ball(.65,'#a9dc98',[-5.05,2.2,z]);box([.08,.8,.08],'#d7b38d',[-5.02,1.5,z]);}
 box([11,.18,.14],'#f8e7c9',[0,.18,-4.06]);
 // Downloaded restaurant counters, plus pastel cabinet faces and a warm worktop.
 for(const x of [-2.6,-.8,1]){const c=prop('counter',1.65,[x,0,-.15],Math.PI);c.scale.x*=.55;c.scale.z*=.42;}
 box([5.6,.16,1.45],'#f3c9a2',[-.8,1.66,-.15]);
 for(let x=0;x<9;x++)for(let y=0;y<2;y++)box([.59,.56,.035],['#b3e6d8','#f6b6d1','#cdb9ec','#f9df9b'][(x+y)%4],[-3.25+x*.61,.44+y*.59,.59]);
 for(const x of [-3.4,1.8])box([.08,1.5,.08],'#fff2d7',[x,.8,.62]);
 // Back bar, floating shelves and the menu board.
 box([5.8,.12,.65],'#e3b896',[.6,2.8,-3.8]);box([5.8,.12,.65],'#e3b896',[.6,3.7,-3.8]);
 prop('shelf',.8,[-3.7,2.6,-3.9]);prop('coffee',.8,[-2.7,1.75,-.35],Math.PI/2);
 prop('cake',.65,[-1.8,1.75,-.1]);prop('cup',.3,[.8,1.75,-.15]);
 for(let i=0;i<5;i++){prop('croissant',.22,[-.9+i*.6,2.87,-3.75]);prop('cup',.27,[-.6+i*.6,3.77,-3.75]);}
 box([2.1,1.9,.14],'#e8b48e',[2.7,2.8,-4]);box([1.9,1.7,.16],'#52746c',[2.7,2.8,-3.98]);
 // Pictorial menu: a cake, cup and golden bun, no reading needed.
 for(let i=0;i<3;i++){const y=3.3-i*.5;ball(.12,['#f5c0dc','#e4f1e7','#f4c97c'][i],[2.2,y,-3.83]);box([.7,.045,.03],'#d6e4d2',[2.9,y,-3.82]);}
 for(const pos of [[3.7,0,-2.5],[-4,0,2.2]]){prop('table',1.12,pos);prop('chair',.92,[pos[0]+.9,0,pos[2]+.15],-Math.PI/2);prop('plant',.45,[pos[0],1.12,pos[2]]);}
 prop('plant',.8,[4.4,0,-3.6]);prop('plant',.48,[-3.5,1.75,-.25]);
 // A string of warm globe lights on a plum wire across the back wall; each bulb twinkles on its own beat.
 const bulbs=[],wire=[];
 for(let i=0;i<13;i++){const x=-4.8+i*.8,y=4.65-.35*Math.sin(i/12*Math.PI);wire.push(new T.Vector3(x,y+.08,-3.92));const bulb=ball(.085,'#ffe39a',[x,y-.06,-3.9]);bulb.castShadow=false;bulb.material.emissive=new T.Color('#ffcf70');bulbs.push(bulb);}
 const wireMesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(wire),60,.018,6,false),new T.MeshBasicMaterial({color:PLUM}));wireMesh.userData.noOutline=true;scene.add(wireMesh);
 const glow=particles(13,.55,spriteTex('puff'),['#ffd98a'],T.AdditiveBlending);bulbs.forEach((b,i)=>glow.geometry.attributes.position.setXYZ(i,b.position.x,b.position.y,b.position.z+.05));scene.add(glow);
 // Paper notepad sits on the counter; its camera destination is shared with the trace overlay.
 const note=new T.Group();scene.add(note);note.position.set(.1,1.78,.15);note.rotation.x=-.10;box([.77,.035,.9],'#9d80be',[0,0,0],note);box([.68,.04,.8],'#fff6df',[0,.025,.02],note);
 for(let i=0;i<5;i++)box([.45,.006,.012],'#c5c0d2',[0,.05,-.2+i*.1],note).userData.noOutline=true;const pencil=mesh(new T.CylinderGeometry(.025,.025,.68,8),'#e9a5bb',[.47,.05,0],note);pencil.rotation.x=Math.PI/2;pencil.rotation.z=.2;
 // Chibi chef (original CC0 model) stands behind the counter on a low bakers' step and waves.
 const GX=-.5,GZ=-1.2,GR=.5,GY=1.4;box([1.5,GY,1.1],'#e7c7a4',[GX,GY/2,GZ],scene);const girl=prop('girl',2.45,[GX,GY,GZ],GR);
 const gArmL=part(girl,'arm_L'),gArmR=part(girl,'arm_R'),gHead=part(girl,'head'),gBody=part(girl,'body');
 // Chunky pastel unicorn (original CC0 model): legs, head and tail are separate joints.
 const unicorn=prop('unicorn',2.75,[6,0,2.4],-Math.PI/2);
 const legs=['leg_FL','leg_BR','leg_FR','leg_BL'].map((n,i)=>({g:part(unicorn,n),phase:i<2?0:Math.PI})),uHead=part(unicorn,'head'),uTail=part(unicorn,'tail');
 // Window light: a soft warm patch of sunlight on the floor under the window.
 const beam=new T.Mesh(new T.BoxGeometry(2.2,.01,3.9),new T.MeshBasicMaterial({color:'#fff6d2',transparent:true,opacity:.42,depthWrite:false}));beam.position.set(-3.7,.03,-.55);beam.userData.noOutline=true;scene.add(beam);
 addOutlines(scene);
 // Sparkles drift around the unicorn and in the window light; steam curls up from the cups.
 const star=spriteTex('star'),SPARK=['#ffd45e','#ff9fd0','#c6a4ff','#8fe3ff','#ffffff'];
 const uniSpark=particles(36,.36,star,SPARK),winSpark=particles(22,.28,star,['#ffe48a','#fff6c8','#ffc4e1']);scene.add(uniSpark,winSpark);
 const steamSrc=[[.8,2.08,-.15],[-2.55,2.35,-.35],[-1.8,2.45,-.1]];const steam=particles(steamSrc.length*6,.3,spriteTex('puff'),['#ffffff']);scene.add(steam);
 let active=true,start=performance.now(),glideAt=0,done=null,wasReady=false;const glideFrom=new T.Vector3(),glideLook=new T.Vector3(),q=new T.Quaternion(),e=new T.Euler();
 const turn=(g,x,y,z)=>{e.set(x,y,z);g.quaternion.copy(g.userData.rest).multiply(q.setFromEuler(e));};
 const resize=()=>{const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();outlinePx.value.set(2*OUTLINE_PX/w,2*OUTLINE_PX/h,0);};resize();addEventListener('resize',resize);
 function life(t,walk){
  const sp=uniSpark.geometry.attributes,u=unicorn.position;
  for(let i=0;i<36;i++){const a=t*.5*(.6+rnd(i))+rnd(i+9)*6.3,r=.9+rnd(i+3)*.7,h=(t*.18*(.5+rnd(i+5))+rnd(i+7))%1;sp.position.setXYZ(i,u.x+Math.cos(a)*r,.5+h*2.6,u.z+Math.sin(a)*r*.8);sp.color.setW(i,Math.max(0,Math.sin(t*3*(.6+rnd(i+1))+i*2.1))*Math.sin(h*Math.PI));}
  sp.position.needsUpdate=sp.color.needsUpdate=true;
  const wp=winSpark.geometry.attributes;
  for(let i=0;i<22;i++){const h=(t*.06*(.5+rnd(i+20))+rnd(i+21))%1,s=rnd(i+22);wp.position.setXYZ(i,-5+s*2.4+h*.6,3.6-h*3.2-s*.6+Math.sin(t+i)*.08,-2.6+rnd(i+23)*3.8);wp.color.setW(i,.35+.65*Math.max(0,Math.sin(t*2.2*(.5+rnd(i+24))+i)));}
  wp.position.needsUpdate=wp.color.needsUpdate=true;
  const st=steam.geometry.attributes;
  steamSrc.forEach(([x,y,z],k)=>{for(let j=0;j<6;j++){const i=k*6+j,h=(t*.32+j/6+k*.13)%1;st.position.setXYZ(i,x+Math.sin(h*7+k+t)*.07*h,y+h*.75,z);st.color.setW(i,.75*Math.sin(h*Math.PI)*(1-h*.4));}});
  st.position.needsUpdate=st.color.needsUpdate=true;
  bulbs.forEach((b,i)=>{const k=.5+.5*Math.sin(t*(1.7+rnd(i)*1.6)+i*1.9);b.material.emissiveIntensity=.35+.75*k;glow.geometry.attributes.color.setW(i,.25+.6*k);});glow.geometry.attributes.color.needsUpdate=true;
 }
 function tick(now){requestAnimationFrame(tick);if(!active||document.hidden)return;const t=fixedT??(now-start)/1000,walk=Math.min(1,t/3.8),ease=walk*walk*(3-2*walk),trot=walk<1;
  unicorn.position.set(6-5.1*ease,trot?Math.abs(Math.sin(t*9))*.07:.03+.04*Math.sin(t*2.2),2.4);unicorn.rotation.y=-Math.PI/2+.85*ease;
  for(const l of legs)turn(l.g,trot?Math.sin(t*9+l.phase)*.5:0,0,0);
  turn(uHead,trot?Math.sin(t*18)*.04:Math.sin(t*1.7)*.07-.03,0,trot?0:Math.sin(t*.9)*.08);turn(uTail,0,Math.sin(t*(trot?9:2.4))*.28,0);
  // Chef: a little bounce, a happy head tilt, one arm waving hello and the other swinging.
  girl.position.y=GY+Math.abs(Math.sin(t*2.6))*.035;turn(gHead,0,0,Math.sin(t*1.6)*.08);turn(gBody,0,Math.sin(t*1.1)*.06,0);
  turn(gArmL,.85,0,2.35+Math.sin(t*7)*.3);turn(gArmR,0,0,-.15-Math.sin(t*2.6)*.08);
  life(t,walk);
  if(!wasReady&&walk===1){wasReady=true;host.dataset.ready='true';}
  if(glideAt){const p=Math.min(1,(now-glideAt)/1500),k=p*p*(3-2*p);camera.position.lerpVectors(glideFrom,new T.Vector3(1.3,3.3,2.5),k);camera.lookAt(glideLook.clone().lerp(new T.Vector3(.1,1.75,.15),k));if(p===1){glideAt=0;const cb=done;done=null;cb?.();}}
  renderer.render(scene,camera);
 }
 requestAnimationFrame(tick);
 return {show(value){active=value;host.hidden=!value;},glide(callback){if(done)return;glideFrom.copy(camera.position);glideLook.copy(look);glideAt=performance.now();done=callback;},home(){camera.position.copy(home);camera.lookAt(look);},get ready(){return wasReady;}};
}
