// Gera máscaras do produto (tecido da camiseta/ecobag e cerâmica da caneca) para recolorir com realismo.
// Uso: node mascaras.js [--so=g1,g5,natal] [--debug]   (requer: npm i @techstark/opencv-js sharp)
const fs=require('fs'),vm=require('vm'),path=require('path'),sharp=require('sharp');
const SITE=path.resolve(process.env.SITE||path.join(__dirname,'..')),DEBUG=process.argv.includes('--debug');
const so=(process.argv.find(a=>a.startsWith('--so='))||'').slice(5).split(',').filter(Boolean);
const load=f=>new vm.Script(fs.readFileSync(path.join(SITE,f),'utf8')+';({a:typeof CENARIOS!=="undefined"?CENARIOS:null,b:typeof CANECAS_SCENES!=="undefined"?CANECAS_SCENES:null,c:typeof CANECAS_META!=="undefined"?CANECAS_META:null})').runInNewContext({});
const GARM=load('data/cenarios.js').a,MUGD=load('data/canecas.js');
let cv;const SC=.5;                                   // GrabCut roda em meia resolução
async function readRGB(file){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height;
  const rgb=Buffer.alloc(W*H*3),al=Buffer.alloc(W*H);
  for(let i=0;i<W*H;i++){const a=data[i*4+3]/255;for(let c=0;c<3;c++)rgb[i*3+c]=Math.round(data[i*4+c]*a+[238,232,237][c]*(1-a));al[i]=data[i*4+3];}
  return {rgb,al,W,H};
}
const small=(buf,W,H,ch,w,h)=>{let p=sharp(buf,{raw:{width:W,height:H,channels:ch}}).resize(w,h,{kernel:'lanczos3'});if(ch===1)p=p.extractChannel(0);return p.raw().toBuffer();};
const mat=(buf,h,w,type)=>{const m=new cv.Mat(h,w,type);m.data.set(buf);return m;};
const kern=n=>cv.getStructuringElement(cv.MORPH_ELLIPSE,new cv.Size(n,n));
function grab(rgbS,w,h,init){                         // init: Uint8Array 0/1/2/3
  const src=mat(rgbS,h,w,cv.CV_8UC3),m=mat(init,h,w,cv.CV_8UC1),bg=new cv.Mat(),fg=new cv.Mat();
  cv.grabCut(src,m,new cv.Rect(0,0,w,h),bg,fg,4,cv.GC_INIT_WITH_MASK);
  const out=new Uint8Array(w*h);for(let i=0;i<w*h;i++)out[i]=(m.data[i]===1||m.data[i]===3)?255:0;
  src.delete();m.delete();bg.delete();fg.delete();return out;
}
function fillHoles(bin,w,h){const out=Uint8Array.from(bin),seen=new Uint8Array(w*h),q=[];const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const i=y*w+x;if(seen[i]||bin[i])return;seen[i]=1;q.push(i);};for(let x=0;x<w;x++){push(x,0);push(x,h-1);}for(let y=0;y<h;y++){push(0,y);push(w-1,y);}while(q.length){const i=q.pop(),x=i%w,y=(i/w)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}for(let i=0;i<w*h;i++)if(!bin[i]&&!seen[i])out[i]=255;return out;}
function morph(bin,w,h,op,n){const m=mat(bin,h,w,cv.CV_8UC1),k=kern(n);if(op==='erode')cv.erode(m,m,k);else if(op==='dilate')cv.dilate(m,m,k);else cv.morphologyEx(m,m,op==='close'?cv.MORPH_CLOSE:cv.MORPH_OPEN,k);const o=Uint8Array.from(m.data);m.delete();k.delete();return o;}
function comps(bin,w,h){const m=mat(bin,h,w,cv.CV_8UC1),lb=new cv.Mat(),st=new cv.Mat(),ce=new cv.Mat();const n=cv.connectedComponentsWithStats(m,lb,st,ce);const L=Int32Array.from(lb.data32S),A=[];for(let i=1;i<n;i++)A.push(st.intAt(i,4));m.delete();lb.delete();st.delete();ce.delete();return {n,L,A};}
const keepLargest=(bin,w,h,k=1,at=null)=>{const {n,L,A}=comps(bin,w,h);const ids=A.map((a,i)=>[a,i+1]).sort((p,q)=>q[0]-p[0]).slice(0,k).map(p=>p[1]);if(at!=null&&L[at])ids.push(L[at]);const o=new Uint8Array(w*h);for(let i=0;i<w*h;i++)if(ids.includes(L[i]))o[i]=255;return o;};
async function finish(bin,w,h,W,H,file){                // sobe para a resolução original, suaviza e salva
  const up=await sharp(Buffer.from(bin),{raw:{width:w,height:h,channels:1}}).resize(W,H,{kernel:'cubic'}).blur(1.4).extractChannel(0).raw().toBuffer();
  const o=Buffer.alloc(W*H);for(let i=0;i<W*H;i++)o[i]=Math.max(0,Math.min(255,(up[i]-128)*2.2+128));   // reforça a borda após o blur
  fs.mkdirSync(path.dirname(file),{recursive:true});
  await sharp(o,{raw:{width:W,height:H,channels:1}}).webp({quality:82,smartSubsample:false}).toFile(file);return o;
}
/* ---------- camisetas e ecobags ---------- */
// dica por cenário: 'borda' = a parede/piso claro chega às bordas da foto, então a faixa externa é fundo (ensina a cor do fundo ao GrabCut)
const DICAS={20:{borda:1,preencher:1,parede:[2.5,7],cortes:[[0,.2,.05,1],[0,.5,.14,1],[0,.2,.12,.42]]},30:{borda:1},15:{rect:[.2,.15,.7,.96],core:[.3,.5,.6,.85],cortes:[[.2,.15,.35,.42],[.49,.15,.75,.42]]},16:{lmin:75,lmax:75,thr:14,cortes:[[0,.2,.2,.37],[.84,.2,1,.46]]},41:{lmin:75,lmax:75,thr:14,cortes:[[0,.15,.2,.45],[.74,.15,1,.5]]},19:{sementes:[[.80,.55]]},44:{sementes:[[.80,.35]]},58:{rect:[.17,.07,.83,.97],core:[.34,.55,.70,.90]}};
async function garment(c){
  const {rgb,al,W,H}=await readRGB(path.join(SITE,`assets/cena-${String(c.id).padStart(2,'0')}.webp`)),w=Math.round(W*SC),h=Math.round(H*SC);
  const rs=await small(rgb,W,H,3,w,h),as=await small(al,W,H,1,w,h);
  const src=mat(rs,h,w,cv.CV_8UC3),lab=new cv.Mat();cv.cvtColor(src,lab,cv.COLOR_RGB2Lab);
  const [zx,zy,zw,zh]=c.zona,cx=Math.round((zx+zw/2)*w),cy=Math.round((zy+zh/2)*h),r=Math.round(Math.min(zw,zh)*w*.15);
  const sl=[[],[],[]];for(let y=cy-r;y<cy+r;y++)for(let x=cx-r;x<cx+r;x++)for(let k=0;k<3;k++)sl[k].push(lab.data[(y*w+x)*3+k]);
  const med=sl.map(a=>a.sort((p,q)=>p-q)[a.length>>1]);
  const WT=(DICAS[c.id]||{}).parede||[5,14];let wall=null;if((DICAS[c.id]||{}).borda){const bx=Math.round(w*.045),by=Math.round(h*.035),wl=[[],[],[]];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<bx||x>=w-bx||y<by)for(let k=0;k<3;k++)wl[k].push(lab.data[(y*w+x)*3+k]);wall=wl.map(q=>q.sort((p,r)=>p-r)[q.length>>1]);}
  const LMIN=(DICAS[c.id]||{}).lmin||62,LMAX=(DICAS[c.id]||{}).lmax||30;let cand,thr=(DICAS[c.id]||{}).thr||9;for(;;thr=16){cand=new Uint8Array(w*h);let nn=0;for(let i=0;i<w*h;i++){const d=Math.abs(lab.data[i*3+1]-med[1])+Math.abs(lab.data[i*3+2]-med[2]);const nw=wall&&Math.abs(lab.data[i*3+1]-wall[1])+Math.abs(lab.data[i*3+2]-wall[2])<WT[0]&&Math.abs(lab.data[i*3]-wall[0])<WT[1];if(!nw&&d<thr&&lab.data[i*3]>med[0]-LMIN&&lab.data[i*3]<med[0]+LMAX&&as[i]>250){cand[i]=255;nn++;}}if(nn>w*h*.04||thr>=16)break;}
  for(const [sx,sy] of (DICAS[c.id]||{}).sementes||[]){const px=Math.round(sx*w),py=Math.round(sy*h),q=[[],[],[]];for(let y=py-r;y<py+r;y++)for(let x=px-r;x<px+r;x++)for(let k=0;k<3;k++)q[k].push(lab.data[(y*w+x)*3+k]);const m2=q.map(a=>a.sort((p,t)=>p-t)[a.length>>1]);for(let i=0;i<w*h;i++){const d=Math.abs(lab.data[i*3+1]-m2[1])+Math.abs(lab.data[i*3+2]-m2[2]);if(d<thr&&lab.data[i*3]>m2[0]-LMIN&&lab.data[i*3]<m2[0]+LMAX&&as[i]>250)cand[i]=255;}}
  src.delete();lab.delete();
  if(c.tipo!=='dupla'){const E=c.tipo==='ecobag'?[.6,.6,1.8,.7]:[1.0,1.0,.8,.9],ex0=Math.max(0,Math.round((zx-E[0]*zw)*w)),ex1=Math.min(w,Math.round((zx+zw+E[1]*zw)*w)),ey0=Math.max(0,Math.round((zy-E[2]*zh)*h)),ey1=Math.min(h,Math.round((zy+zh+E[3]*zh)*h));for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<ex0||x>=ex1||y<ey0||y>=ey1)cand[y*w+x]=0;}
  if((DICAS[c.id]||{}).borda){const bx=Math.round(w*.045),by=Math.round(h*.035);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<bx||x>=w-bx||y<by)cand[y*w+x]=0;}
  cand=morph(cand,w,h,'close',5);cand=morph(cand,w,h,'open',c.tipo==='ecobag'?5:9);cand=keepLargest(cand,w,h,c.tipo==='dupla'?2:1,cy*w+cx);
  const sureFG=morph(cand,w,h,'erode',9),dil=morph(cand,w,h,'dilate',17),init=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)init[i]=sureFG[i]?1:cand[i]?3:dil[i]?2:0;
  const hint=DICAS[c.id]||{};if(hint.rect){const R=(q)=>[Math.round(q[0]*w),Math.round(q[1]*h),Math.round(q[2]*w),Math.round(q[3]*h)],r=R(hint.rect),k=R(hint.core);init.fill(0);for(let y=r[1];y<r[3];y++)for(let x=r[0];x<r[2];x++)init[y*w+x]=3;for(let y=k[1];y<k[3];y++)for(let x=k[0];x<k[2];x++)init[y*w+x]=1;}
  let m=grab(rs,w,h,init);m=morph(m,w,h,'open',3);m=morph(m,w,h,'close',5);m=keepLargest(m,w,h,c.tipo==='dupla'?2:1,cy*w+cx);if(hint.cortes)for(const q of hint.cortes)for(let y=Math.round(q[1]*h);y<Math.round(q[3]*h);y++)for(let x=Math.round(q[0]*w);x<Math.round(q[2]*w);x++)m[y*w+x]=0;m=keepLargest(m,w,h,c.tipo==='dupla'?2:1,cy*w+cx);if(hint.preencher)m=fillHoles(m,w,h);
  const o=await finish(m,w,h,W,H,path.join(SITE,`assets/mascaras/cena-${String(c.id).padStart(2,'0')}.webp`));
  return {rgb,W,H,o};
}
/* ---------- canecas ---------- */
async function mug(key){
  const s=MUGD.b[key],file=path.join(SITE,s.src),{rgb,al,W,H}=await readRGB(file),w=Math.round(W*SC),h=Math.round(H*SC);
  const rs=await small(rgb,W,H,3,w,h),as=await small(al,W,H,1,w,h),K=SC;
  const toI=(m,xu,yu)=>{const f=(m.rot||0)*Math.PI/180,cp=Math.cos(f),sp=Math.sin(f),px=m.cx,py=(m.yTopC+m.yBotC)/2,dx=xu-px,dy=yu-py;return [(px+dx*cp-dy*sp)*K,(py+dx*sp+dy*cp)*K];};
  const poly=(m,pts)=>pts.map(([x,y])=>toI(m,x,y));
  const fill=(polys)=>{const mm=cv.Mat.zeros(h,w,cv.CV_8UC1);for(const p of polys){const v=cv.matFromArray(p.length,1,cv.CV_32SC2,p.flat().map(Math.round));const vec=new cv.MatVector();vec.push_back(v);cv.fillPoly(mm,vec,new cv.Scalar(255));v.delete();vec.delete();}const o=Uint8Array.from(mm.data);mm.delete();return o;};
  const body=[],handleBox=[];
  for(const m of s.mugs){
    const top=[],bot=[],N=48;
    for(let j=0;j<=N;j++){const t=-1+2*j/N,k=Math.sqrt(Math.max(0,1-t*t));top.push([m.cx+t*m.R,m.yTopC-m.ryT*(1-k)]);bot.push([m.cx+t*m.R,m.yBotC-m.ryB*(1-k)]);}
    body.push(poly(m,[...top,...bot.reverse()]));
    const el=[];for(let j=0;j<N*2;j++){const a=j/(N*2)*Math.PI*2;el.push([m.cx+Math.cos(a)*m.R*1.015,m.yTopC-m.ryT+Math.sin(a)*m.ryT*1.1]);}body.push(poly(m,el));
    const hd=m.handle||(m.half===0?-1:1);handleBox.push(poly(m,[[m.cx+hd*m.R*.8,m.yTopC-m.ryT],[m.cx+hd*m.R*2.45,m.yTopC-m.ryT],[m.cx+hd*m.R*2.45,m.yBotC],[m.cx+hd*m.R*.8,m.yBotC]]));
  }
  const B=fill(body),HB=fill(handleBox),sureFG=morph(B,w,h,'erode',9),dil=morph(B,w,h,'dilate',9),hbd=morph(HB,w,h,'dilate',9);
  // branco de referência da cerâmica (percentil alto do corpo) para reconhecer a alça
  const srcM=mat(rs,h,w,cv.CV_8UC3),labM=new cv.Mat();cv.cvtColor(srcM,labM,cv.COLOR_RGB2Lab);srcM.delete();const bl=[[],[],[]];for(let i=0;i<w*h;i++)if(sureFG[i])for(let k=0;k<3;k++)bl[k].push(labM.data[i*3+k]);const bm=bl.map(a=>a.sort((p,q)=>p-q)[a.length>>1]),ref=bm[0];
  const init=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){const r_=rs[i*3],g_=rs[i*3+1],b_=rs[i*3+2],mx=Math.max(r_,g_,b_),mn=Math.min(r_,g_,b_),L=(r_+g_+b_)/3,sat=(mx-mn)/(mx+1);
    const white=Math.abs(labM.data[i*3+1]-bm[1])+Math.abs(labM.data[i*3+2]-bm[2])<13&&labM.data[i*3]>ref*.55&&labM.data[i*3]<ref*1.3&&as[i]>250;
    init[i]=as[i]<200?0:sureFG[i]?1:dil[i]?3:(HB[i]&&white)?3:hbd[i]?2:0;}
  labM.delete();let m=grab(rs,w,h,init);m=morph(m,w,h,'open',3);m=morph(m,w,h,'close',5);
  const o=await finish(m,w,h,W,H,path.join(SITE,`assets/canecas/mascaras/${key}.webp`));return {rgb,W,H,o};
}
async function overlay(r,name){const out=Buffer.from(r.rgb);for(let i=0;i<r.W*r.H;i++){const a=r.o[i]/255;out[i*3]=out[i*3]*(1-a*.55)+255*a*.55*0;out[i*3+1]=out[i*3+1]*(1-a*.5);out[i*3+2]=out[i*3+2]*(1-a*.5)+ 200*a*.5*0+0;out[i*3]=Math.min(255,out[i*3]+a*90);}
  await sharp(out,{raw:{width:r.W,height:r.H,channels:3}}).resize(300,300,{fit:'fill'}).jpeg({quality:80}).toFile(`dbg/${name}.jpg`);}
(async()=>{
  cv=require('@techstark/opencv-js');if(cv instanceof Promise)cv=await cv;await new Promise(r=>{if(cv.Mat)r();else cv.onRuntimeInitialized=r;});
  if(DEBUG)fs.mkdirSync('dbg',{recursive:true});
  const jobs=[];GARM.forEach(c=>jobs.push(['g'+c.id,()=>garment(c)]));Object.keys(MUGD.b).forEach(k=>jobs.push([k,()=>mug(k)]));
  let n=0;const t0=Date.now();
  for(const [id,f] of jobs){if(so.length&&!so.includes(id))continue;try{const r=await f();if(DEBUG)await overlay(r,id);n++;if(n%10==0)console.log(n,'feitos',((Date.now()-t0)/1000|0)+'s');}catch(e){console.log('ERRO',id,e.message||e);}}
  console.log('fim',n,'máscaras em',((Date.now()-t0)/1000|0)+'s');
})();
