'use strict';
/* Motor de camisetas e ecobags: deslocamento pelo relevo + luz do tecido, editor com alças, guias e histórico */
const Garment=(()=>{
'use strict';
/* Almatiê Mockups v11 — motor de renderização por cenário + editor preciso */
const W0=1254,RAD=Math.PI/180,cv=$('preview'),g0=cv.getContext('2d',{alpha:false}),ov=$('interaction'),ox=ov.getContext('2d');
const p2=n=>String(n).padStart(2,'0'),clampv=(v,a,b)=>Math.max(a,Math.min(b,v));
const SC=CENARIOS.map(c=>({...c,src:`assets/cena-${p2(c.id)}.webp`,thumb:`assets/thumbs/cena-${p2(c.id)}.webp`}));
const P={cx:600,cy:600,w:300,h:300,rot:0,alpha:92,dobra:60,luz:85,modo:'mult',lock:true};
let cur=SC[0],scene=null,art=null,artBlob=null,artName='',sel=true,drag=null,guides=[],filt='todos',q='',hist=[],hi=-1,raf=0,tok=0;
const cache=new Map();
const loadImg=src=>cache.get(src)||(cache.set(src,new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>{cache.delete(src);ko(Error('Falha ao abrir '+src.slice(0,40)))};i.src=src})),cache.get(src));
const zone=()=>{const[a,b,c,d]=cur.zona;return{x:a*W0,y:b*W0,w:c*W0,h:d*W0}};
const ext=(Q=P)=>{const c=Math.abs(Math.cos(Q.rot*RAD)),s=Math.abs(Math.sin(Q.rot*RAD));return[(Q.w*c+Q.h*s)/2,(Q.w*s+Q.h*c)/2]};
function clamp(){const z=zone();let[ex,ey]=ext();const k=Math.min(1,z.w/(2*ex),z.h/(2*ey));if(k<1){P.w*=k;P.h*=k;ex*=k;ey*=k}
 P.cx=clampv(P.cx,z.x+ex,z.x+z.w-ex);P.cy=clampv(P.cy,z.y+ey,z.y+z.h-ey)}
function fit(){const z=zone(),r=art?art.naturalWidth/art.naturalHeight:1;P.rot=0;P.w=Math.min(z.w*.78,z.h*.78*r);P.h=P.w/r;P.cx=z.x+z.w/2;P.cy=z.y+z.h/2;clamp()}
/* ---------- renderização ---------- */
function box(s,d,n,m,r,st,ln){for(let l=0;l<n;l++){const o=l*ln;let a=0;for(let x=-r;x<=r;x++)a+=s[o+Math.min(m-1,Math.max(0,x))*st];
 for(let x=0;x<m;x++){d[o+x*st]=a/(2*r+1);a+=s[o+Math.min(m-1,x+r+1)*st]-s[o+Math.max(0,x-r)*st]}}}
function blur(a,w,h,r){r=Math.round(r);if(r<1)return a;const b=new Float32Array(a.length),c=new Float32Array(a.length);box(a,b,h,w,r,1,w);box(b,c,w,h,r,w,1);box(c,b,h,w,r,1,w);box(b,c,w,h,r,w,1);return c}
/* Pipeline: (1) estampa girada/escalada em camada própria na resolução de saída; (2) mapas da foto do cenário:
   luz ampla (blur grande) + detalhe de dobras (foto / luz ampla) + gradiente → deslocamento; (3) amostragem bilinear
   deslocada, sombreamento calibrado pela referência de brilho do cenário e mescla final. */
function compose(g,S,artOnly){
 const k=S/W0;if(!artOnly){g.fillStyle='#eee8ed';g.fillRect(0,0,S,S);g.drawImage(sceneC||scene,0,0,S,S)}if(!art)return;
 const[ex,ey]=ext(),pd=Math.ceil(16*k+2),mg=Math.ceil(40*k);
 const bx0=Math.max(0,Math.floor((P.cx-ex)*k)-pd),by0=Math.max(0,Math.floor((P.cy-ey)*k)-pd),bx1=Math.min(S,Math.ceil((P.cx+ex)*k)+pd),by1=Math.min(S,Math.ceil((P.cy+ey)*k)+pd);
 const rx=Math.max(0,bx0-mg),ry=Math.max(0,by0-mg),rw=Math.min(S,bx1+mg)-rx,rh=Math.min(S,by1+mg)-ry;
 const mk=()=>{const c=document.createElement('canvas');c.width=rw;c.height=rh;return c.getContext('2d',{willReadFrequently:true})};
 const pg=mk(),ag=mk(),SRC=sceneC||scene,sr=(SRC.naturalWidth||SRC.width)/S;
 pg.fillStyle='#eee8ed';pg.fillRect(0,0,rw,rh);pg.imageSmoothingQuality='high';pg.drawImage(SRC,rx*sr,ry*sr,rw*sr,rh*sr,0,0,rw,rh);
 ag.imageSmoothingQuality='high';ag.translate(P.cx*k-rx,P.cy*k-ry);ag.rotate(P.rot*RAD);ag.drawImage(art,-P.w*k/2,-P.h*k/2,P.w*k,P.h*k);
 const A=ag.getImageData(0,0,rw,rh).data,I=pg.getImageData(0,0,rw,rh),D=I.data,N=rw*rh,pa=new Float32Array(N*4),L=new Float32Array(N);
 for(let i=0;i<N;i++){const j=i*4,a=A[j+3]/255;pa[j]=A[j]*a;pa[j+1]=A[j+1]*a;pa[j+2]=A[j+2]*a;pa[j+3]=a;L[i]=.2126*D[j]+.7152*D[j+1]+.0722*D[j+2]}
 const low=blur(L,rw,rh,18*k),mid=blur(L,rw,rh,2.5*k),s=P.dobra/100,lz=P.luz/100,amp=s*9*k,lim=amp*1.3,al=P.alpha/100,mult=P.modo==='mult'&&!artOnly,ref=refEff||cur.ref;
 const out=artOnly?new ImageData(rw,rh):I,O=out.data;
 for(let y=0;y<rh;y++){const yu=Math.max(0,y-2)*rw,yd=Math.min(rh-1,y+2)*rw;for(let x=0;x<rw;x++){
  const i=y*rw+x,j=i*4,xl=Math.max(0,x-2),xr=Math.min(rw-1,x+2);
  const fx=x+clampv(-(mid[y*rw+xr]-mid[y*rw+xl])*amp/25,-lim,lim),fy=y+clampv(-(mid[yd+x]-mid[yu+x])*amp/25,-lim,lim);
  if(fx<0||fy<0||fx>=rw-1||fy>=rh-1)continue;
  const x0=fx|0,y0=fy|0,tx=fx-x0,ty=fy-y0,b=(y0*rw+x0)*4,c=b+rw*4,w0=(1-tx)*(1-ty),w1=tx*(1-ty),w2=(1-tx)*ty,w3=tx*ty;
  const a=pa[b+3]*w0+pa[b+7]*w1+pa[c+3]*w2+pa[c+7]*w3;if(a<.004)continue;
  const lo=low[i]+1,Li=L[i],sh=clampv(Math.pow(Math.min(1.25,lo/ref),lz*1.4)*Math.pow(Math.min(1.6,Li/lo),s*4.5),.3,1.15),ao=a*al;
  for(let ch=0;ch<3;ch++){let v=(pa[b+ch]*w0+pa[b+4+ch]*w1+pa[c+ch]*w2+pa[c+4+ch]*w3)/a*sh;
   if(mult)v*=clampv(D[j+ch]/(Li+1),.8,1.15);
   if(artOnly)O[j+ch]=v;else O[j+ch]=D[j+ch]*(1-ao)+v*ao}
  if(artOnly)O[j+3]=ao*255}}
 g.putImageData(out,rx,ry)}
const render=()=>{if(!scene)return;try{compose(g0,W0,false)}catch(e){if(e.name=='SecurityError'){g0.drawImage(scene,0,0,W0,W0);$('sceneLabel').textContent='Abra por servidor (veja LEIA-ME): o navegador bloqueia arquivos locais';return}throw e}drawSel()};
const req=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(render)};
/* ---------- seleção, alças e guias ---------- */
const HS=[['tl',-1,-1],['tr',1,-1],['bl',-1,1],['br',1,1],['t',0,-1],['b',0,1],['l',-1,0],['r',1,0]],CUR={tl:'nwse-resize',br:'nwse-resize',tr:'nesw-resize',bl:'nesw-resize',t:'ns-resize',b:'ns-resize',l:'ew-resize',r:'ew-resize',rot:'grab',in:'move'};
function drawSel(){ox.clearRect(0,0,W0,W0);if(!art||!scene||!(sel||drag))return;const z=zone();ox.save();ox.lineWidth=2.5;ox.setLineDash([10,8]);ox.strokeStyle='rgba(255,255,255,.9)';ox.strokeRect(z.x,z.y,z.w,z.h);ox.strokeStyle='rgba(216,50,139,.75)';ox.lineDashOffset=9;ox.strokeRect(z.x,z.y,z.w,z.h);ox.restore();
 ox.save();ox.lineWidth=2;ox.strokeStyle='#ff2f9a';guides.forEach(([t,v])=>{ox.beginPath();t=='v'?(ox.moveTo(v,0),ox.lineTo(v,W0)):(ox.moveTo(0,v),ox.lineTo(W0,v));ox.stroke()});ox.restore();
 ox.save();ox.translate(P.cx,P.cy);ox.rotate(P.rot*RAD);ox.lineWidth=2.5;ox.strokeStyle='#d8328b';ox.strokeRect(-P.w/2,-P.h/2,P.w,P.h);
 ox.beginPath();ox.moveTo(0,-P.h/2);ox.lineTo(0,-P.h/2-40);ox.stroke();ox.fillStyle='#fff';
 HS.forEach(([n,sx,sy])=>{ox.beginPath();n.length==2?ox.arc(sx*P.w/2,sy*P.h/2,11,0,7):ox.rect(sx*P.w/2-8,sy*P.h/2-8,16,16);ox.fill();ox.stroke()});
 ox.beginPath();ox.arc(0,-P.h/2-40,11,0,7);ox.fillStyle='#d8328b';ox.fill();ox.restore()}
const pt=e=>{const r=ov.getBoundingClientRect();return[(e.clientX-r.left)*W0/r.width,(e.clientY-r.top)*W0/r.height]};
const loc=(x,y,Q=P)=>{const c=Math.cos(Q.rot*RAD),s=Math.sin(Q.rot*RAD),dx=x-Q.cx,dy=y-Q.cy;return[dx*c+dy*s,-dx*s+dy*c]};
function hit(x,y,touch){const[lx,ly]=loc(x,y),r=touch?40:26;if(Math.hypot(lx,ly+P.h/2+40)<r)return'rot';
 for(const[n,sx,sy]of HS)if(Math.hypot(lx-sx*P.w/2,ly-sy*P.h/2)<r)return n;return Math.abs(lx)<=P.w/2&&Math.abs(ly)<=P.h/2?'in':null}
function snap(){guides=[];const z=zone(),[ex,ey]=ext(),T=8;
 const f=(c,ts,t)=>{let b=null;ts.forEach(([v,gv])=>{if(Math.abs(c-v)<T&&(!b||Math.abs(c-v)<Math.abs(c-b[0])))b=[v,gv]});if(b)guides.push([t,b[1]]);return b?b[0]:c};
 P.cx=f(P.cx,[[z.x+z.w/2,z.x+z.w/2],[z.x+ex,z.x],[z.x+z.w-ex,z.x+z.w]],'v');P.cy=f(P.cy,[[z.y+z.h/2,z.y+z.h/2],[z.y+ey,z.y],[z.y+z.h-ey,z.y+z.h]],'h')}
ov.addEventListener('pointerdown',e=>{if(!art||!scene)return;const[x,y]=pt(e),h=hit(x,y,e.pointerType=='touch');if(!h){sel=false;drawSel();return}
 sel=true;drag={h,x,y,Q:{...P},l0:loc(x,y)};ov.setPointerCapture(e.pointerId);e.preventDefault();drawSel()});
ov.addEventListener('pointermove',e=>{const[x,y]=pt(e);if(!drag){if(art&&sel){const h=hit(x,y,e.pointerType=='touch');ov.style.cursor=h?CUR[h]:'default'}return}
 const{h,Q}=drag;guides=[];
 if(h=='in'){P.cx=Q.cx+x-drag.x;P.cy=Q.cy+y-drag.y;clamp();if(!e.altKey)snap();clamp()}
 else if(h=='rot'){let a=Math.atan2(y-Q.cy,x-Q.cx)/RAD+90;if(a>180)a-=360;if(!e.altKey){const n=Math.round(a/15)*15;if(Math.abs(a-n)<4)a=n}P.rot=Math.round(a*10)/10;clamp()}
 else{const[sx,sy]=HS.find(v=>v[0]==h).slice(1),l=loc(x,y,Q),dw=sx*(l[0]-drag.l0[0]),dh=sy*(l[1]-drag.l0[1]);let nw=Q.w+dw,nh=Q.h+dh;
  if(P.lock!==e.shiftKey){const s=sx&&sy?Math.max(nw/Q.w,nh/Q.h):sx?nw/Q.w:nh/Q.h;nw=Q.w*s;nh=Q.h*s}
  nw=Math.max(24,nw);nh=Math.max(24,nh);if(!sx)nw=Q.w;if(!sy)nh=Q.h;
  const lx=sx*(nw-Q.w)/2,ly=sy*(nh-Q.h)/2,c=Math.cos(Q.rot*RAD),s=Math.sin(Q.rot*RAD);P.w=nw;P.h=nh;P.cx=Q.cx+lx*c-ly*s;P.cy=Q.cy+lx*s+ly*c;clamp()}
 syncUI();req();e.preventDefault()});
const endDrag=()=>{if(!drag)return;drag=null;guides=[];commit();req()};ov.addEventListener('pointerup',endDrag);ov.addEventListener('pointercancel',endDrag);
addEventListener('keydown',e=>{if(document.body.dataset.mode!=='g')return;const t=e.target.tagName,k=e.key,m=e.ctrlKey||e.metaKey;
 if(m&&k.toLowerCase()=='z'){e.preventDefault();e.shiftKey?redo():undo();return}if(m&&k.toLowerCase()=='y'){e.preventDefault();redo();return}
 if(t=='INPUT'||t=='SELECT'||t=='TEXTAREA'||!art)return;if(k=='Escape'){sel=false;req();return}if(!sel)return;
 const d=e.shiftKey?10:1,v={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[k];if(v){e.preventDefault();P.cx+=v[0];P.cy+=v[1];clamp();syncUI();req();clearTimeout(window._kt);window._kt=setTimeout(commit,400)}});
/* ---------- histórico ---------- */
const snapState=()=>JSON.stringify(P);
function commit(){const s=snapState();if(hist[hi]===s)return;hist=hist.slice(0,hi+1);hist.push(s);if(hist.length>100)hist.shift();hi=hist.length-1;btns()}
function restore(){Object.assign(P,JSON.parse(hist[hi]));syncUI();btns();req()}
const undo=()=>{if(hi>0){hi--;restore()}},redo=()=>{if(hi<hist.length-1){hi++;restore()}},btns=()=>{$('undo').disabled=hi<1;$('redo').disabled=hi>=hist.length-1};
/* ---------- controles ---------- */
const SL={size:()=>Math.round(P.w/zone().w*100),rot:()=>P.rot,alpha:()=>P.alpha,dobra:()=>P.dobra,luz:()=>P.luz};
function syncUI(){for(const k in SL){const v=Math.round(SL[k]());$(k).value=v;$('o'+k).textContent=v+(k=='rot'?'°':'%')}$('lock').checked=P.lock;$('modo').value=P.modo;
 $('dims').textContent=art?`${Math.round(P.w)} × ${Math.round(P.h)} px · centro ${Math.round(P.cx)}, ${Math.round(P.cy)}`:''}
const SET={size(v){const r=P.w/P.h;P.w=zone().w*v/100;if(P.lock)P.h=P.w/r;else P.h*=1},rot(v){P.rot=+v},alpha(v){P.alpha=+v},dobra(v){P.dobra=+v},luz(v){P.luz=+v}};
for(const k in SET){$(k).addEventListener('input',e=>{SET[k](+e.target.value);clamp();syncUI();req()});$(k).addEventListener('change',commit)}
$('modo').onchange=e=>{P.modo=e.target.value;commit();req()};$('lock').onchange=e=>{P.lock=e.target.checked;commit()};
$('cH').onclick=()=>{const z=zone();P.cx=z.x+z.w/2;clamp();syncUI();commit();req()};$('cV').onclick=()=>{const z=zone();P.cy=z.y+z.h/2;clamp();syncUI();commit();req()};
$('reset').onclick=()=>{fit();P.dobra=cur.dobra;syncUI();commit();req()};$('undo').onclick=undo;$('redo').onclick=redo;

/* ---------- cor do produto: foto recolorida com máscara do cenário (assets/mascaras) ---------- */
let tint=null,sceneC=null,refEff=0;
async function applyTint(){
  sceneC=null;refEff=0;if(!tint||!scene)return true;
  const mi=await Cor.loadMask('assets/mascaras/cena-'+p2(cur.id)+'.webp');if(!mi)return false;
  const W=scene.naturalWidth,H=scene.naturalHeight,c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(scene,0,0);
  const id=x.getImageData(0,0,W,H),M=Cor.maskPixels(mi,W,H,(q,im)=>q.drawImage(im,0,0,W,H));
  const k=Cor.recolor(id.data,M,W*H,tint,{gloss:.1,sheen:.022,hi:[1.35,1.7]});if(k==null)return false;
  x.putImageData(id,0,0);sceneC=c;refEff=cur.ref*k;return true;
}
async function setTint(hex,quiet){tint=hex||null;if(quiet)return true;const ok=await applyTint();if(!ok){tint=null;sceneC=null;refEff=0;}render();return ok;}
/* ---------- cenários e estampa ---------- */
async function load(id){const s=SC.find(x=>x.id==id);if(!s)return false;const t=++tok;cur=s;
 try{const img=await loadImg(s.src);if(t!==tok)return false;scene=img;await applyTint();if(t!==tok)return false;fit();P.dobra=s.dobra;syncUI();commit();render();
  const i=SC.indexOf(s);(window.requestIdleCallback||setTimeout)(()=>[1,-1].forEach(d=>SC[i+d]&&loadImg(SC[i+d].src).catch(()=>0)));return true}
 catch(err){console.error(err);return false}}
function setArt(img){art=img;sel=true;P.lock=true;fit();syncUI();commit();render()}
const demo=()=>loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700"><rect width="900" height="700" rx="60" fill="#f7e6ef"/><circle cx="450" cy="350" r="245" fill="#873fa0"/><text x="450" y="330" text-anchor="middle" font-family="Georgia" font-size="105" font-weight="bold" fill="#fff">SUA ARTE</text><text x="450" y="420" text-anchor="middle" font-family="Arial" font-size="42" fill="#fff">Almatiê Art</text></svg>'));
const size=()=>Math.round(W0*+$('expSize').value);
function blob(type){const c=document.createElement('canvas');c.width=c.height=size();const g=c.getContext('2d'),only=$('expArt').checked&&type!=='jpg';
 compose(g,c.width,only);return new Promise(r=>c.toBlob(r,type==='jpg'?'image/jpeg':'image/png',.93))}
return {setTint,load,setArt,demo,blob,size,render,sel:()=>sel,getState:()=>({...P}),setState:o=>{Object.assign(P,o);syncUI();commit();render()}};
})();
