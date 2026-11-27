'use strict';
/* Motor de canecas: projeção cilíndrica da arte, cenas sem fundo, espelhar, fundos e efeitos.
   (código original do projeto de canecas, adaptado para conviver com o motor de camisetas) */
const Mug=(()=>{
const SCENES=CANECAS_SCENES,META=CANECAS_META,MUG_DEFAULT_ART=CANECAS_ARTE;
const ORDER=Object.keys(META).sort((a,b)=>META[a].order-META[b].order);
const OUT_SIZE=1800;
let W=OUT_SIZE,H=OUT_SIZE;
let MUGS=[];let activeScene=null;
const FRAME_H=960, FRAME_W=Math.round(FRAME_H*210/95);   // área de impressão 210 × 95 mm
const DEFAULTS={gap:32,margin:0.8,ink:100,vol:130,gloss:55,grain:30};
const DEBUG=location.search.includes('debug');
const canvas=document.getElementById('mockup');
const ctx=canvas.getContext('2d',{willReadFrequently:true});
const statusEl=document.getElementById('status'),artInput=document.getElementById('artInput'),fitMode=document.getElementById('fitMode'),wrap=document.getElementById('wrap');
const controls=['gap','margin','ink','vol','gloss','grain'];
const fmt={gap:v=>v+'°',margin:v=>v+'%',ink:v=>v+'%',vol:v=>v+'%',gloss:v=>v+'%',grain:v=>v+'%'};
let tint=null,tintPart='all',opaque=false;
let basePix=null,outImg=null,frame=null,artImg=null,objectUrl=null,wp=[],artName='arte de exemplo';
const say=m=>{statusEl.textContent=m;};
function loadImage(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src;});}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
/* Converte a arte para o quadro de impressão 210×95 (com alfa) */
function buildFrame(img){
  const c=document.createElement('canvas');c.width=FRAME_W;c.height=FRAME_H;
  const g=c.getContext('2d',{willReadFrequently:true});
  const ia=img.width/img.height, fa=FRAME_W/FRAME_H;
  let dw,dh;
  if(fitMode.value==='cover'){ if(ia>fa){dh=FRAME_H;dw=FRAME_H*ia;}else{dw=FRAME_W;dh=FRAME_W/ia;} }
  else{ if(ia>fa){dw=FRAME_W;dh=FRAME_W/ia;}else{dh=FRAME_H;dw=FRAME_H*ia;} }
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.drawImage(img,(FRAME_W-dw)/2,(FRAME_H-dh)/2,dw,dh);
  return {w:FRAME_W,h:FRAME_H,d:g.getImageData(0,0,FRAME_W,FRAME_H).data};
}

/* ---- geometria: espaço "reto" da caneca  <->  pixels da foto ---- */
function toImg(m,xu,yu){
  const f=(m.rot||0)*Math.PI/180,cp=Math.cos(f),sp=Math.sin(f);
  const px=m.cx,py=(m.yTopC+m.yBotC)/2,dx=xu-px,dy=yu-py;
  return [px+dx*cp-dy*sp, py+dx*sp+dy*cp];
}
const handleOf=m=>m.handle||(m.half===0?-1:1);

/* Branco de referência (iluminado) de cada caneca, medido na própria foto */
function measureWhite(m,px=basePix){
  const vals=[[],[],[]];
  const h=m.yBotC-m.yTopC;
  for(let yu=m.yTopC+h*.14;yu<m.yBotC-h*.16;yu+=3)for(let xu=m.cx-m.R*.85;xu<m.cx+m.R*.85;xu+=3){
    const [xi,yi]=toImg(m,xu,yu),i=((yi|0)*W+(xi|0))*4;
    vals[0].push(px[i]);vals[1].push(px[i+1]);vals[2].push(px[i+2]);
  }
  return vals.map(a=>{a.sort((p,q)=>p-q);const n=a.length,s=Math.floor(n*.93);let t=0;for(let i=s;i<n;i++)t+=a[i];return t/(n-s);});
}

/* Perfil de brilho do esmalte extraído da própria foto: onde a caneca real
   reflete a luz (faixas verticais claras), o reflexo sobre a arte aparece também. */
const SPEC_N=160;
function buildSpec(m,px=basePix){
  const prof=new Float32Array(SPEC_N),h=m.yBotC-m.yTopC;
  for(let j=0;j<SPEC_N;j++){
    const s=-0.97+1.94*j/(SPEC_N-1),k=Math.sqrt(1-s*s);
    const yT=m.yTopC-m.ryT*(1-k),yB=m.yBotC-m.ryB*(1-k);
    let acc=0;
    for(let t=0;t<12;t++){
      const yu=yT+(yB-yT)*(0.16+0.68*t/11),[xi,yi]=toImg(m,m.cx+s*m.R,yu),i=((yi|0)*W+(xi|0))*4;
      acc+=(px[i]+px[i+1]+px[i+2])/3;
    }
    prof[j]=acc/12;
  }
  const blur=(a,r)=>{const o=new Float32Array(a.length);for(let i=0;i<a.length;i++){let t=0,n=0;for(let d=-r;d<=r;d++){const q=i+d;if(q>=0&&q<a.length){t+=a[q];n++;}}o[i]=t/n;}return o;};
  const sm=blur(prof,2), low=blur(blur(prof,16),16);
  const hp=new Float32Array(SPEC_N);let mx=0;
  for(let j=0;j<SPEC_N;j++){hp[j]=Math.max(0,sm[j]-low[j]);if(j>6&&j<SPEC_N-6)mx=Math.max(mx,hp[j]);}
  m.spec=null;
  if(mx>3.5){m.spec=new Float32Array(SPEC_N);for(let j=0;j<SPEC_N;j++)m.spec[j]=Math.min(1,hp[j]/mx);}
}
function specAt(m,s){
  const g=Math.exp(-Math.pow((s+.56)/.08,2))*.6+Math.exp(-Math.pow((s-.86)/.04,2))*.35;   // reserva
  if(!m.spec)return g;
  const f=(clamp(s,-.97,.97)+.97)/1.94*(SPEC_N-1),i=f|0,t=f-i;
  const v=m.spec[i]*(1-t)+m.spec[Math.min(SPEC_N-1,i+1)]*t;
  return v*.9+g*.1;
}

function params(){
  const p={};controls.forEach(k=>p[k]=parseFloat($(k).value));
  p.gapRad=p.gap*Math.PI/180;
  p.m0=p.margin/100;p.m1=p.margin/100*1.15;p.opaque=opaque;
  return p;
}

function renderMug(m,idx,P,out){
  const SX=P.fast?2:3,SY=P.fast?2:3,inv=1/(SX*SY);
  const f=(m.rot||0)*Math.PI/180,cp=Math.cos(f),sp=Math.sin(f);
  const px=m.cx,py=(m.yTopC+m.yBotC)/2;
  const hnd=handleOf(m), outerSign=-hnd;            // lado oposto à alça
  const fw=frame.w,fh=frame.h,fd=frame.d,halfW=fw/2,halfOff=m.half*halfW;
  const span=Math.PI-P.gapRad;                       // arco coberto pela arte
  const OVERPX=m.over!==undefined?m.over:3.5;                                    // sobra no lado oposto à alça: nunca fica margem branca
  // caixa delimitadora (caneca pode estar inclinada)
  let bx0=1e9,bx1=-1e9,by0=1e9,by1=-1e9;
  for(const [ux,uy] of [[m.cx-m.R-8,m.yTopC-m.ryT-8],[m.cx+m.R+8,m.yTopC-m.ryT-8],[m.cx-m.R-8,m.yBotC+8],[m.cx+m.R+8,m.yBotC+8]]){
    const [ix,iy]=toImg(m,ux,uy);bx0=Math.min(bx0,ix);bx1=Math.max(bx1,ix);by0=Math.min(by0,iy);by1=Math.max(by1,iy);
  }
  const x0=Math.max(0,Math.floor(bx0)),x1=Math.min(W-1,Math.ceil(bx1)),y0=Math.max(0,Math.floor(by0)),y1=Math.min(H-1,Math.ceil(by1));
  const W0=wp[idx];
  const ink=P.ink/100, vol=P.vol/100, gloss=P.gloss/100, grain=P.grain/100, opq=!!P.opaque;
  const vspan=1-P.m0-P.m1;
  const W0m=(W0[0]+W0[1]+W0[2])/3;
  for(let y=y0;y<=y1;y++){
    for(let x=x0;x<=x1;x++){
      let ar=0,ag=0,ab=0,aa=0,cov=0;
      for(let sy=0;sy<SY;sy++){
        const ys=y+(sy+.5)/SY;
        for(let sx=0;sx<SX;sx++){
          const xs=x+(sx+.5)/SX,dx=xs-px,dy=ys-py;
          const xu=px+dx*cp+dy*sp, yu=py-dx*sp+dy*cp;
          let s=(xu-m.cx)/m.R;
          const so=s*outerSign;
          if(so>=1){ if((so-1)*m.R>OVERPX)continue; s=outerSign*.9995; }
          else if(so<=-1)continue;
          const k=Math.sqrt(1-s*s), th=Math.asin(s);
          const d=outerSign>0?(Math.PI/2-th):(th+Math.PI/2);   // 0 = lado oposto … π = lado da alça
          if(d>span)continue;                                  // faixa branca junto à alça
          const t=d/span, uu=hnd<0?1-t:t;
          const yT=m.yTopC-m.ryT*(1-k), yB=m.yBotC-m.ryB*(1-k);
          const v=(yu-yT)/(yB-yT);
          if(v<P.m0||v>1-P.m1)continue;
          const fx=Math.min(fw-1.001,Math.max(0,(halfOff+uu*halfW)-.5)), ix=fx|0, tx=fx-ix;
          const fy=Math.min(fh-1.001,Math.max(0,((v-P.m0)/vspan)*fh-.5)), iy=fy|0, ty=fy-iy;
          const i00=(iy*fw+ix)*4,i10=i00+4,i01=i00+fw*4,i11=i01+4;
          const w00=(1-tx)*(1-ty),w10=tx*(1-ty),w01=(1-tx)*ty,w11=tx*ty;
          const a00=fd[i00+3]*w00,a10=fd[i10+3]*w10,a01=fd[i01+3]*w01,a11=fd[i11+3]*w11;
          cov++;
          aa+=a00+a10+a01+a11;
          ar+=fd[i00]*a00+fd[i10]*a10+fd[i01]*a01+fd[i11]*a11;
          ag+=fd[i00+1]*a00+fd[i10+1]*a10+fd[i01+1]*a01+fd[i11+1]*a11;
          ab+=fd[i00+2]*a00+fd[i10+2]*a10+fd[i01+2]*a01+fd[i11+2]*a11;
        }
      }
      if(cov===0)continue;
      const i=(y*W+x)*4;
      const C0=cov*inv;
      // posição do centro do pixel no espaço reto da caneca
      const dxc=x+.5-px,dyc=y+.5-py;
      const xuc=px+dxc*cp+dyc*sp, yuc=py-dxc*sp+dyc*cp;
      const sRaw=(xuc-m.cx)/m.R, s=clamp(sRaw,-.9995,.9995);
      // proteção: perto da silhueta, não pinta sobre fundo colorido (pele, folhas, parede)
      let C=C0;
      if(m.mask){C*=m.mask[y*W+x]/255;if(C<=0)continue;}
      if(m.fullGuard||Math.abs(sRaw)>1-7/m.R){
        const r_=basePix[i],g_=basePix[i+1],b_=basePix[i+2],mx=Math.max(r_,g_,b_),mn=Math.min(r_,g_,b_);
        const sat=(mx-mn)/(mx+1), lum=(r_+g_+b_)/3;
        C*=(1-smooth(.11,.22,sat))*smooth(.28*W0m,.5*W0m,lum);
        if(C<=0)continue;
      }
      const Aa=aa/(255*cov), R_=ar/(65025*cov), G_=ag/(65025*cov), B_=ab/(65025*cov);
      const inkL=[Aa-R_,Aa-G_,Aa-B_],rgbA=[R_,G_,B_];                          // quanto a tinta escurece, por canal
      const dens=opq?Math.min(1,Aa*1.2):Math.min(1,(inkL[0]+inkL[1]+inkL[2])/3*1.6);  // densidade real da tinta (branco = 0)
      const kc=Math.sqrt(1-s*s);
      const yT=m.yTopC-m.ryT*(1-kc), yB=m.yBotC-m.ryB*(1-kc);
      const vv=clamp((yuc-yT)/(yB-yT),0,1);
      // brilho do esmalte seguindo as faixas de luz da foto
      const vf=smooth(0,.08,vv)*smooth(0,.10,1-vv);
      const G=gloss*.62*specAt(m,s)*vf;
      // oclusão leve junto da base/aro e escurecimento nas laterais (curvatura)
      const ao=1-0.10*clamp((vv-.90)/.10,0,1)-0.05*clamp((.06-vv)/.06,0,1);
      const edgeDark=0.10*(vol/1.3)*Math.pow(Math.abs(s),3);
      const nz=(((Math.sin(x*12.9898+y*78.233)*43758.5453)%1)+1)%1-.5;
      for(let c=0;c<3;c++){
        const base=basePix[i+c];
        const shadeBase=Math.min(1,base/W0[c]);
        let val=opq?base*(1-Math.min(1,Aa*ink*C))+255*rgbA[c]*ink*C*shadeBase:base*(1-ink*C*inkL[c]);
        val*=1-(vol-1)*(1-shadeBase)*dens*C;      // reforça o volume onde há tinta
        val*=1-(1-ao)*dens*C;
        val*=1-edgeDark*dens*C;
        val+=(255-val)*G*C;                       // reflexo (screen)
        val+=nz*grain*4*(0.4+dens)*C;             // granulação do esmalte
        out[i+c]=val<0?0:val>255?255:val;
      }
    }
  }
}


let pending=false,fastMode=false,fullTimer=null;
function renderNow(fast=false){
  if(!basePix||!frame||!outImg)return;
  const P=params();P.fast=fast;
  const out=outImg.data;out.set(basePix);
  MUGS.forEach((m,i)=>renderMug(m,i,P,out));
  ctx.putImageData(outImg,0,0);
  if(DEBUG)drawDebug();
}
/* fast=true: prévia leve enquanto o controle é arrastado; qualidade total logo depois */
function render(fast=false){
  if(!basePix||!frame)return;
  fastMode=fast;clearTimeout(fullTimer);
  if(fast)fullTimer=setTimeout(()=>render(false),240);
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;renderNow(fastMode);});
}
function drawDebug(){
  ctx.save();ctx.strokeStyle='rgba(255,0,0,.9)';ctx.lineWidth=1;
  const P=params();
  MUGS.forEach(m=>{
    const path=(pts)=>{ctx.beginPath();pts.forEach(([ux,uy],j)=>{const [x,y]=toImg(m,ux,uy);j?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();};
    for(const [yc,ry] of [[m.yTopC,m.ryT],[m.yBotC,m.ryB]]){
      const pts=[];for(let x=-m.R;x<=m.R;x+=2){const s=x/m.R,k=Math.sqrt(Math.max(0,1-s*s));pts.push([m.cx+x,yc-ry*(1-k)]);}
      path(pts);
    }
    path([[m.cx-m.R,m.yTopC-m.ryT],[m.cx-m.R,m.yBotC-m.ryB]]);
    path([[m.cx+m.R,m.yTopC-m.ryT],[m.cx+m.R,m.yBotC-m.ryB]]);
    ctx.strokeStyle='rgba(0,120,255,.9)';
    const sg=handleOf(m)*Math.cos(P.gapRad)*-1*-1;  // limite da faixa branca
    const sx=handleOf(m)*Math.sin(Math.PI/2-P.gapRad)*m.R;
    path([[m.cx+sx,m.yTopC-m.ryT],[m.cx+sx,m.yBotC]]);
    ctx.strokeStyle='rgba(255,0,0,.9)';
  });
  ctx.restore();
}


function setArt(img,name,isExample=false,silent=true){
  artImg=img;artName=name;frame=buildFrame(img);render(false);say('Estampa atualizada: '+name+'.');
  if(!silent){const r=img.width/img.height;toast(Math.abs(r/(210/95)-1)>0.06?'Arte aplicada ✓ · proporção diferente de 210 × 95 mm, ajustada automaticamente':'Arte aplicada ✓');}
}

/* controles de realismo: prévia rápida enquanto arrasta, qualidade total ao soltar */
const savedAdj=store.get('adj',null);if(savedAdj)controls.forEach(k=>{if(savedAdj[k]!=null)$(k).value=savedAdj[k];});
controls.forEach(k=>{
  const el=$(k),out=$('o_'+k);const upd=()=>{out.textContent=fmt[k](el.value);};
  el.addEventListener('input',()=>{upd();render(true);});el.addEventListener('change',()=>{render(false);store.set('adj',Object.fromEntries(controls.map(c=>[c,+$(c).value])));});upd();
});
$('resetAdj').addEventListener('click',()=>{controls.forEach(k=>{$(k).value=DEFAULTS[k];$('o_'+k).textContent=fmt[k](DEFAULTS[k]);});render(false);store.set('adj',null);toast('Ajustes restaurados');});
fitMode.addEventListener('change',()=>{if(artImg){frame=buildFrame(artImg);render(false);}});
/* ---------- carregamento de cenários (com cache e pré-carregamento) ---------- */
const cache=new Map();let loadSeq=0,currentCut=null,currentEntry=null;
const maskFor=e=>{
  if(!bg.mirror)return e.alpha;
  if(!e.alphaM){const T=OUT_SIZE,a=e.alpha,b=new Uint8Array(a.length);for(let y=0;y<T;y++){const r=y*T;for(let x=0;x<T;x++)b[r+x]=a[r+T-1-x];}e.alphaM=b;}
  return e.alphaM;
};
const mirrorMug=(m,mask)=>bg.mirror?{...m,cx:OUT_SIZE-m.cx,rot:-m.rot,handle:-(m.handle||1),half:1-m.half,mask}:{...m,mask};
async function prepareScene(key){
  const ck=key+'|'+(tint||'-')+'|'+tintPart;
  if(cache.has(ck)){const e=cache.get(ck);cache.delete(ck);cache.set(ck,e);return e;}
  const scene=SCENES[key],baseImg=await loadImage(scene.src);
  const T=OUT_SIZE,sc=T/Math.max(scene.width,scene.height),ox=(scene.width*sc-T)/2,oy=(scene.height*sc-T)/2;
  const m=scene.mugs.map(m=>({...m,cx:m.cx*sc-ox,R:m.R*sc,yTopC:m.yTopC*sc-oy,ryT:m.ryT*sc,yBotC:m.yBotC*sc-oy,ryB:m.ryB*sc}));
  const c=document.createElement('canvas');c.width=T;c.height=T;
  const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const dw=scene.width*sc,dh=scene.height*sc;
  let entry;
  if(scene.cutout){
    g.drawImage(baseImg,-ox,-oy,dw,dh);
    const d=g.getImageData(0,0,T,T).data,alpha=new Uint8Array(T*T);
    for(let i=0,p=3;i<alpha.length;i++,p+=4)alpha[i]=d[p];
    entry={cutout:true,cut:c,mugs:m,alpha,alphaM:null,tintM:tint?await buildTintMask(scene,m,T,ox,oy,dw,dh):null};
  }else{
    g.drawImage(baseImg,-ox,-oy,dw,dh);
    if(oy<-0.5){const b=-oy;
      g.save();g.beginPath();g.rect(0,0,T,b);g.clip();g.filter='blur(14px)';g.translate(0,b);g.scale(1,-1);g.drawImage(baseImg,0,0,dw,dh);g.restore();
      g.save();g.beginPath();g.rect(0,b+dh,T,b+2);g.clip();g.filter='blur(14px)';g.translate(0,b+dh);g.scale(1,-1);g.drawImage(baseImg,0,-dh,dw,dh);g.restore();}
    if(ox<-0.5){const b=-ox;
      g.save();g.beginPath();g.rect(0,0,b,T);g.clip();g.filter='blur(14px)';g.translate(b,0);g.scale(-1,1);g.drawImage(baseImg,0,0,dw,dh);g.restore();
      g.save();g.beginPath();g.rect(b+dw,0,b+2,T);g.clip();g.filter='blur(14px)';g.translate(b+dw,0);g.scale(-1,1);g.drawImage(baseImg,-dw,0,dw,dh);g.restore();}
    const px=new Uint8ClampedArray(g.getImageData(0,0,T,T).data);
    if(tint){const M=await buildTintMask(scene,m,T,ox,oy,dw,dh);if(M)Cor.recolor(px,M,T*T,tint,TINTO);}
    const w=m.map(mm=>measureWhite(mm,px));m.forEach(mm=>buildSpec(mm,px));
    entry={px,mugs:m,wp:w,single:m.length===1};
  }
  cache.set(ck,entry);
  while(cache.size>6)cache.delete(cache.keys().next().value);
  return entry;
}
/* cenas sem fundo: fundo escolhido + recorte (com sombra) → pixels base */
function composeCutout(e){
  const T=OUT_SIZE;
  if(!e.comp){e.comp=document.createElement('canvas');e.comp.width=T;e.comp.height=T;e.compCtx=e.comp.getContext('2d',{willReadFrequently:true});}
  const g=e.compCtx;g.setTransform(1,0,0,1,0,0);g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetY=0;g.clearRect(0,0,T,T);
  drawBackground(g,T);
  g.save();
  if(bg.mirror){g.translate(T,0);g.scale(-1,1);}
  if(bg.shadow>0){g.shadowColor=`rgba(45,20,55,${(0.55*bg.shadow/100).toFixed(3)})`;g.shadowBlur=T*0.04;g.shadowOffsetY=T*0.02;}
  g.drawImage(e.cut,0,0);
  g.restore();
  const px=new Uint8ClampedArray(g.getImageData(0,0,T,T).data);
  if(e.tintM&&tint)Cor.recolor(px,bg.mirror?flipMask(e.tintM):e.tintM,T*T,tint,TINTO);
  const mask=maskFor(e),mugs=e.mugs.map(m=>mirrorMug(m,mask));
  const w=mugs.map(mm=>measureWhite(mm,px));mugs.forEach(mm=>buildSpec(mm,px));
  return {px,mugs,wp:w};
}
let recQueued=false,hintedCut=false;
function recompose(){
  if(!currentCut||recQueued)return;recQueued=true;
  requestAnimationFrame(()=>{recQueued=false;if(!currentCut)return;
    const r=composeCutout(currentCut);basePix=r.px;MUGS=r.mugs;wp=r.wp;
    wrap.classList.toggle('transp',bg.type==='color'&&bg.color==='transparent');
    render(true);});
}
function flipPx(px){const T=OUT_SIZE,o=new Uint8ClampedArray(px.length);for(let y=0;y<T;y++){const r=y*T*4;for(let x=0;x<T;x++){const s=r+x*4,d=r+(T-1-x)*4;o[d]=px[s];o[d+1]=px[s+1];o[d+2]=px[s+2];o[d+3]=px[s+3];}}return o;}
function applyEntry(e){
  currentEntry=e;
  if(e.cutout){const r=composeCutout(e);basePix=r.px;MUGS=r.mugs;wp=r.wp;}
  else if(e.single&&bg.mirror){
    if(!e.mir){const px=flipPx(e.px),mugs=e.mugs.map(m=>mirrorMug(m,null));e.mir={px,mugs,wp:mugs.map(mm=>measureWhite(mm,px))};mugs.forEach(mm=>buildSpec(mm,px));}
    basePix=e.mir.px;MUGS=e.mir.mugs;wp=e.mir.wp;
  }else{basePix=e.px;MUGS=e.mugs;wp=e.wp;}
}
function setSceneMode(e){
  currentCut=e&&e.cutout?e:null;currentEntry=e;
  const single=!!e&&(e.cutout||e.single);
  $('cutBox').hidden=!currentCut;$('bgHud').hidden=!currentCut;
  $('mirrorBox').hidden=!single;$('mirrorHud').hidden=!single;
  wrap.classList.toggle('transp',!!currentCut&&bg.type==='color'&&bg.color==='transparent');
  if(currentCut&&!hintedCut){hintedCut=true;setTimeout(()=>toast('🎨 Cena sem fundo: troque o fundo e espelhe a cena em Personalizar',3600),700);}
}
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
async function loadScene(key){
  if(!SCENES[key]||!META[key])return false;
  const my=++loadSeq;activeScene=key;
  wrap.classList.add('loading');await nextFrame();
  try{
    const e=await prepareScene(key);if(my!==loadSeq)return false;
    setSceneMode(e);applyEntry(e);
    if(frame)renderNow();
    wrap.classList.remove('loading');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)canvas.animate([{opacity:.35,transform:'scale(1.025)',filter:'blur(5px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});
    say(`Cenário "${SCENES[key].name}" carregado.`);
    const i=ORDER.indexOf(key),nb=[ORDER[(i+1)%ORDER.length],ORDER[(i-1+ORDER.length)%ORDER.length]];
    (window.requestIdleCallback||(f=>setTimeout(f,400)))(async()=>{for(const k of nb){if(my!==loadSeq)return;if(!cache.has(k))await prepareScene(k);}});
  return true;}catch(err){console.error(err);wrap.classList.remove('loading');return false;}
}

const BG_SWATCHES=['transparent','#ffffff','#f4ede4','#f9dce6','#e8dcf7','#d5e9f8','#d9f0df','#fdeeb4','#f7cfa6','#e85d8a','#8e44ad','#2d6cdf','#18a58a','#f2b632','#2b2233','#111111'];
const rngF=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const lin=(g,T,stops,x0=0,y0=0,x1=0,y1=1)=>{const gr=g.createLinearGradient(x0*T,y0*T,x1*T,y1*T);stops.forEach(([p,c])=>gr.addColorStop(p,c));g.fillStyle=gr;g.fillRect(0,0,T,T);};
const glow=(g,T,cx,cy,r,stops)=>{const gr=g.createRadialGradient(cx*T,cy*T,0,cx*T,cy*T,r*T);stops.forEach(([p,c])=>gr.addColorStop(p,c));g.fillStyle=gr;g.fillRect(0,0,T,T);};
const EFFECTS=[
 {id:'aurora',name:'Aurora',draw:(g,T)=>{lin(g,T,[[0,'#ffd3e8'],[.5,'#cdb6ff'],[1,'#a9dcff']],0,0,1,1);glow(g,T,.2,.25,.55,[[0,'rgba(255,255,255,.6)'],[1,'rgba(255,255,255,0)']]);glow(g,T,.85,.75,.6,[[0,'rgba(255,160,205,.5)'],[1,'rgba(255,160,205,0)']]);glow(g,T,.75,.15,.45,[[0,'rgba(150,200,255,.45)'],[1,'rgba(150,200,255,0)']]);}},
 {id:'sunset',name:'Pôr do sol',draw:(g,T)=>{lin(g,T,[[0,'#ffd9a0'],[.45,'#ff8aa8'],[1,'#7a4fd6']]);glow(g,T,.5,.6,.5,[[0,'rgba(255,244,205,.75)'],[1,'rgba(255,244,205,0)']]);}},
 {id:'ocean',name:'Oceano',draw:(g,T)=>{lin(g,T,[[0,'#9cebe6'],[.55,'#2f86cf'],[1,'#14346f']]);glow(g,T,.3,.15,.6,[[0,'rgba(255,255,255,.45)'],[1,'rgba(255,255,255,0)']]);}},
 {id:'menta',name:'Menta',draw:(g,T)=>{g.fillStyle='#d5f2e6';g.fillRect(0,0,T,T);glow(g,T,.5,.4,.75,[[0,'rgba(255,255,255,.95)'],[1,'rgba(160,226,200,.25)']]);}},
 {id:'noite',name:'Noite estrelada',draw:(g,T)=>{lin(g,T,[[0,'#0d1633'],[1,'#33246a']]);const r=rngF(5);for(let i=0;i<170;i++){g.fillStyle=`rgba(255,255,255,${.25+r()*.75})`;g.beginPath();g.arc(r()*T,r()*T,T*(0.0015+r()*0.0035),0,6.3);g.fill();}glow(g,T,.8,.18,.35,[[0,'rgba(255,240,200,.7)'],[1,'rgba(255,240,200,0)']]);}},
 {id:'holofote',name:'Holofote',draw:(g,T)=>{g.fillStyle='#211b2c';g.fillRect(0,0,T,T);glow(g,T,.5,.42,.72,[[0,'rgba(255,255,255,.96)'],[.45,'rgba(255,232,246,.4)'],[1,'rgba(33,27,44,0)']]);}},
 {id:'bokeh',name:'Bokeh dourado',draw:(g,T)=>{g.fillStyle='#2b1722';g.fillRect(0,0,T,T);const r=rngF(11),cols=['255,205,120','255,170,170','255,230,190','240,170,255'];for(let i=0;i<48;i++){const x=r()*T,y=r()*T,rad=T*(0.025+r()*0.075),c=cols[i%4],gr=g.createRadialGradient(x,y,rad*.2,x,y,rad);gr.addColorStop(0,`rgba(${c},${.35+r()*.3})`);gr.addColorStop(.85,`rgba(${c},${.18})`);gr.addColorStop(1,`rgba(${c},0)`);g.fillStyle=gr;g.beginPath();g.arc(x,y,rad,0,6.3);g.fill();}}},
 {id:'bolinhas',name:'Bolinhas',draw:(g,T)=>{g.fillStyle='#ffd9e8';g.fillRect(0,0,T,T);const s=T/9;g.fillStyle='rgba(255,255,255,.85)';for(let y=0;y<11;y++)for(let x=0;x<11;x++){g.beginPath();g.arc(x*s+(y%2?s/2:0),y*s,s*.25,0,6.3);g.fill();}}},
 {id:'listras',name:'Listras',draw:(g,T)=>{g.fillStyle='#fff';g.fillRect(0,0,T,T);g.save();g.translate(T/2,T/2);g.rotate(-Math.PI/5);const s=T/10;g.fillStyle='#ffc9de';for(let i=-14;i<14;i++)g.fillRect(-T,i*s,T*2,s/2);g.restore();}},
 {id:'ondas',name:'Ondas',draw:(g,T)=>{lin(g,T,[[0,'#fff0f6'],[1,'#ffd9e8']]);const cols=['rgba(216,59,135,.14)','rgba(135,63,160,.14)','rgba(110,170,255,.16)','rgba(255,160,190,.2)','rgba(255,255,255,.5)'];cols.forEach((c,i)=>{g.fillStyle=c;g.beginPath();g.moveTo(0,T);const base=T*(0.35+i*0.13);for(let x=0;x<=T;x+=T/60)g.lineTo(x,base+Math.sin(x/T*6.28*(1.2+i*.25)+i)*T*.045);g.lineTo(T,T);g.closePath();g.fill();});}},
 {id:'confete',name:'Confete',draw:(g,T)=>{g.fillStyle='#fff6ee';g.fillRect(0,0,T,T);const r=rngF(3),cols=['#ff6b9a','#ffc857','#5fd0c4','#8e6bff','#ff9a62'];for(let i=0;i<150;i++){g.save();g.translate(r()*T,r()*T);g.rotate(r()*6.3);g.fillStyle=cols[i%5];g.fillRect(-T*.007,-T*.014,T*.014,T*.028);g.restore();}}},
 {id:'estudio',name:'Estúdio',draw:(g,T)=>{lin(g,T,[[0,'#fbfbfd'],[.64,'#e2e2e9'],[.65,'#ececf1'],[1,'#cfcfd9']]);glow(g,T,.5,.35,.6,[[0,'rgba(255,255,255,.85)'],[1,'rgba(255,255,255,0)']]);}},
 {id:'geo',name:'Geométrico',draw:(g,T)=>{const r=rngF(9),cols=['#ffd1e0','#e6d6ff','#cfe9ff','#d5f5e6','#fff0c4'],n=7,s=T/n;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=cols[(r()*5)|0],b=cols[(r()*5)|0];g.fillStyle=a;g.beginPath();g.moveTo(x*s,y*s);g.lineTo((x+1)*s,y*s);g.lineTo((x+1)*s,(y+1)*s);g.fill();g.fillStyle=b;g.beginPath();g.moveTo(x*s,y*s);g.lineTo((x+1)*s,(y+1)*s);g.lineTo(x*s,(y+1)*s);g.fill();}}}
];
const bg=Object.assign({type:'effect',color:'#f9dce6',effect:'aurora',blur:0,shadow:40,mirror:false},store.get('bg',{}));
if(bg.type==='image')bg.type='effect';
let bgImg=null,bgUrl=null;
function drawBackground(g,T){
  if(bg.type==='color'){if(bg.color==='transparent')return;g.fillStyle=bg.color;g.fillRect(0,0,T,T);}
  else if(bg.type==='effect'){(EFFECTS.find(e=>e.id===bg.effect)||EFFECTS[0]).draw(g,T);}
  else if(bg.type==='image'&&bgImg){
    const ia=bgImg.width/bgImg.height,dw=ia>1?T*ia:T,dh=ia>1?T:T/ia;
    g.save();if(bg.blur>0&&'filter' in g)g.filter=`blur(${(bg.blur*T/900).toFixed(1)}px)`;
    const sc=bg.blur>0?1.08:1;g.translate(T/2,T/2);g.scale(sc,sc);g.drawImage(bgImg,-dw/2,-dh/2,dw,dh);g.restore();
  }else{g.fillStyle='#ece6ee';g.fillRect(0,0,T,T);}
}
const saveBg=()=>store.set('bg',{type:bg.type,color:bg.color,effect:bg.effect,blur:bg.blur,shadow:bg.shadow,mirror:bg.mirror});
const isLight=c=>{if(c==='transparent')return true;const n=parseInt(c.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return (r*299+g*587+b*114)/1000>200;};
function buildBgUI(){
  $('swatches').innerHTML=BG_SWATCHES.map(c=>`<button type="button" class="sw-c ${c==='transparent'?'none':''} ${isLight(c)?'light':''}" data-c="${c}" style="${c==='transparent'?'':'background:'+c}" title="${c==='transparent'?'Sem fundo (PNG transparente)':c}" aria-label="${c==='transparent'?'Sem fundo':'Cor '+c}"></button>`).join('');
  $('effects').innerHTML=EFFECTS.map(e=>`<button type="button" class="fx" data-id="${e.id}"><canvas width="96" height="96"></canvas><span>${e.name}</span></button>`).join('');
  $('effects').querySelectorAll('.fx').forEach((b,i)=>{const g=b.querySelector('canvas').getContext('2d');EFFECTS[i].draw(g,96);});
  syncBgUI();
}
function syncBgUI(){
  const tab=bg.type;
  $('bgTabs').querySelectorAll('button').forEach(b=>{const on=b.dataset.t===tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);});
  document.querySelectorAll('.bgpane').forEach(p=>p.hidden=p.dataset.p!==tab);
  $('swatches').querySelectorAll('.sw-c').forEach(b=>b.classList.toggle('on',tab==='color'&&b.dataset.c===bg.color));
  $('effects').querySelectorAll('.fx').forEach(b=>b.classList.toggle('on',tab==='effect'&&b.dataset.id===bg.effect));
  const cc=/^#[0-9a-f]{6}$/i.test(bg.color)?bg.color:'#f9dce6';$('customColor').value=cc;$('customHex').textContent=bg.color==='transparent'?'sem fundo':cc.toUpperCase();
  $('mirrorBtn').setAttribute('aria-checked',bg.mirror);$('mirrorHud').classList.toggle('on',bg.mirror);
  $('bgblur').value=bg.blur;$('o_bgblur').textContent=bg.blur+' px';$('shadow').value=bg.shadow;$('o_shadow').textContent=bg.shadow+'%';
  $('bgChip').classList.toggle('on',!!bgImg);
}
function setBg(patch,{toastMsg}={}){Object.assign(bg,patch);syncBgUI();saveBg();recompose();if(toastMsg)toast(toastMsg);}
$('swatches').addEventListener('click',e=>{const b=e.target.closest('.sw-c');if(!b)return;ripple(b,e);setBg({type:'color',color:b.dataset.c},{toastMsg:b.dataset.c==='transparent'?'PNG com fundo transparente ✓':null});});
$('effects').addEventListener('click',e=>{const b=e.target.closest('.fx');if(!b)return;ripple(b,e);setBg({type:'effect',effect:b.dataset.id});});
$('customColor').addEventListener('input',e=>setBg({type:'color',color:e.target.value}));
$('bgTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const t=b.dataset.t;
  if(t==='image'&&!bgImg){bg.type='image';syncBgUI();bg.type=(['color','effect'].includes(bg.type)?bg.type:'effect');document.querySelectorAll('.bgpane').forEach(p=>p.hidden=p.dataset.p!=='image');$('bgTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.t==='image'));return;}
  setBg({type:t});});
$('bgblur').addEventListener('input',e=>setBg({blur:+e.target.value}));
$('shadow').addEventListener('input',e=>setBg({shadow:+e.target.value}));
$('bgInput').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f||!/^image\//.test(f.type)){toast('Escolha uma imagem PNG, JPG ou WebP.');return;}
  if(bgUrl)URL.revokeObjectURL(bgUrl);bgUrl=URL.createObjectURL(f);
  try{bgImg=await loadImage(bgUrl);$('bgThumb').src=bgUrl;$('bgName').textContent=f.name;setBg({type:'image'},{toastMsg:'Imagem de fundo aplicada ✓'});}
  catch(err){toast('Não foi possível abrir essa imagem.');}
});
$('bgClear').addEventListener('click',()=>{bgImg=null;$('bgInput').value='';setBg({type:'effect'});toast('Imagem de fundo removida');});
function toggleMirror(){
  if(!currentEntry||!(currentEntry.cutout||currentEntry.single))return;
  const nm=!bg.mirror;bg.mirror=nm;syncBgUI();saveBg();
  if(currentCut)recompose();else{applyEntry(currentEntry);render(true);}
  toast(nm?'↔ Cena espelhada: outro lado da caneca':'↔ Cena original');
}
$('mirrorBtn').addEventListener('click',toggleMirror);
$('mirrorHud').addEventListener('click',toggleMirror);
$('bgHud').addEventListener('click',()=>{
  if(mqDock.matches){openPanel();setTimeout(()=>$('cutBox').scrollIntoView({behavior:'smooth',block:'start'}),420);}
  else $('cutBox').scrollIntoView({behavior:'smooth',block:'start'});
  $('cutBox').animate([{boxShadow:'0 0 0 0 #d83b8700'},{boxShadow:'0 0 0 6px #d83b8744'},{boxShadow:'0 0 0 0 #d83b8700'}],{duration:900});
});

/* ---------- cor da caneca: máscara do cenário (cerâmica + alça); "extras" deixa o corpo branco ---------- */
const TINTO={gloss:.9,sheen:.045,hi:[1.9,2.6],sat:[.3,.55]};   // o esmalte reflete o ambiente: a máscara já é confiável, então o filtro de saturação é frouxo
function flipMask(M){const T=OUT_SIZE,o=new Uint8Array(M.length);for(let y=0;y<T;y++)for(let x=0;x<T;x++)o[y*T+x]=M[y*T+T-1-x];return o;}
async function buildTintMask(scene,m,T,ox,oy,dw,dh){
  const mi=await Cor.loadMask(scene.src.replace('assets/canecas/','assets/canecas/mascaras/').replace(/\.\w+$/,'.webp'));if(!mi)return null;
  const M=Cor.maskPixels(mi,T,T,(g,im)=>g.drawImage(im,-ox,-oy,dw,dh));
  if(tintPart==='extras'){
    const c=document.createElement('canvas');c.width=c.height=T;const g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';
    for(const mm of m){const N=48;g.beginPath();
      for(let j=0;j<=N;j++){const t=-1+2*j/N,k=Math.sqrt(Math.max(0,1-t*t)),[x,y]=toImg(mm,mm.cx+t*mm.R,mm.yTopC-mm.ryT*(1-k));j?g.lineTo(x,y):g.moveTo(x,y);}
      for(let j=N;j>=0;j--){const t=-1+2*j/N,k=Math.sqrt(Math.max(0,1-t*t)),[x,y]=toImg(mm,mm.cx+t*mm.R,mm.yBotC-mm.ryB*(1-k));g.lineTo(x,y);}
      g.closePath();g.fill();}
    const d=g.getImageData(0,0,T,T).data;for(let i=0;i<M.length;i++)M[i]=Math.round(M[i]*(1-d[i*4]/255));
  }
  return M;
}
const setColor=(hex,part,opq)=>{tint=hex||null;tintPart=part||'all';opaque=!!opq;};
const canvasBlob=type=>{
  if(type==='jpg'){const c=document.createElement('canvas');c.width=c.height=OUT_SIZE;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,OUT_SIZE,OUT_SIZE);g.drawImage(canvas,0,0);return new Promise(r=>c.toBlob(r,'image/jpeg',.93));}
  return new Promise(r=>canvas.toBlob(r,'image/png'));
};
const useDefault=async()=>{const im=await loadImage(MUG_DEFAULT_ART);setArt(im,'arte de exemplo',true,true);return im;};
const getState=()=>({adj:Object.fromEntries(controls.map(k=>[k,+$(k).value])),fit:fitMode.value,bg:{type:bg.type,color:bg.color,effect:bg.effect,blur:bg.blur,shadow:bg.shadow,mirror:bg.mirror}});
const setState=s=>{
  if(s.adj)controls.forEach(k=>{if(s.adj[k]!=null){$(k).value=s.adj[k];$('o_'+k).textContent=fmt[k](s.adj[k]);}});
  if(s.fit){fitMode.value=s.fit;if(artImg)frame=buildFrame(artImg);}
  if(s.bg){Object.assign(bg,s.bg);syncBgUI();saveBg();}
  if(currentCut)recompose();else{if(currentEntry)applyEntry(currentEntry);render(false);}
};
const init=()=>{outImg=ctx.createImageData(W,H);buildBgUI();};
return {setColor,refresh:()=>activeScene?loadScene(activeScene):0,init,loadScene,setArt,useDefault,blob:canvasBlob,toggleMirror,getState,setState,size:()=>OUT_SIZE};
})();
