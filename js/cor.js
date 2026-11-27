'use strict';
/* Recoloração realista do produto (camiseta, ecobag ou caneca).
   Em vez de pintar por cima, o pixel é re-iluminado: calcula-se quanto cada pixel reflete em relação ao
   "branco" medido no próprio cenário (em luz linear) e essa razão é aplicada à nova cor. Assim dobras, sombras,
   textura do tecido, cor da luz e reflexos do esmalte da foto original são preservados. */
const Cor=(()=>{
const PALETA=[
 {id:'orig',nome:'Original (branca)',hex:null},
 {id:'preta',nome:'Preta',hex:'#1b1b1d'},{id:'grafite',nome:'Grafite',hex:'#4a4d53'},{id:'mescla',nome:'Cinza mescla',hex:'#9ea1a7'},
 {id:'cru',nome:'Cru',hex:'#e9dfc9'},{id:'bege',nome:'Bege',hex:'#d6c0a0'},{id:'marrom',nome:'Marrom',hex:'#5d3b2a'},
 {id:'amarelo',nome:'Amarelo',hex:'#f3c431'},{id:'laranja',nome:'Laranja',hex:'#ee7a2b'},{id:'vermelho',nome:'Vermelho',hex:'#c71f2d'},
 {id:'vinho',nome:'Vinho',hex:'#6b1d34'},{id:'rosa',nome:'Rosa',hex:'#ee8fb0'},{id:'pink',nome:'Pink',hex:'#d6338c'},
 {id:'lilas',nome:'Lilás',hex:'#b9a1db'},{id:'roxo',nome:'Roxo',hex:'#5a2f8e'},{id:'bebe',nome:'Azul bebê',hex:'#a9cdea'},
 {id:'royal',nome:'Azul royal',hex:'#1e50b5'},{id:'marinho',nome:'Azul marinho',hex:'#16254b'},{id:'turquesa',nome:'Turquesa',hex:'#1fa6a4'},
 {id:'bandeira',nome:'Verde bandeira',hex:'#1c8a4b'},{id:'militar',nome:'Verde militar',hex:'#4c5b37'}
];
const lin=new Float32Array(256);for(let i=0;i<256;i++)lin[i]=Math.pow(i/255,2.2);
const toS=v=>(v<0?0:v>1?1:Math.pow(v,1/2.2))*255;
const sm=(a,b,x)=>{const t=x<=a?0:x>=b?1:(x-a)/(b-a);return t*t*(3-2*t);};
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
/* luminância linear (0..1) de uma cor hex: decide se a cor é escura (estampa opaca, brilho de tecido) */
const lumOf=h=>{const c=rgb(h).map(v=>lin[v]);return .2126*c[0]+.7152*c[1]+.0722*c[2];};

/* D: RGBA (modificado no lugar) · M: máscara 0-255 por pixel · retorna a razão de luminância nova/antiga */
function recolor(D,M,n,hex,o={}){
  const gloss=o.gloss??.1,sheen=o.sheen??.06,hi=o.hi||[1.35,1.7],satG=o.sat||[.07,.2];
  const T=rgb(hex),Tl=T.map(v=>lin[v]),Tlum=.2126*Tl[0]+.7152*Tl[1]+.0722*Tl[2];
  /* 1) branco de referência: média dos pixels mais claros (percentis 80–97) dentro da máscara */
  const idx=[];for(let i=0;i<n;i+=5)if(M[i]>200)idx.push(i);
  if(idx.length<150)return null;
  const Ls=idx.map(i=>.2126*D[i*4]+.7152*D[i*4+1]+.0722*D[i*4+2]).sort((a,b)=>a-b);
  const lo=Ls[Math.floor(Ls.length*.80)],up=Ls[Math.floor(Ls.length*.97)];
  const F=[0,0,0];let nf=0;
  for(const i of idx){const L=.2126*D[i*4]+.7152*D[i*4+1]+.0722*D[i*4+2];if(L>=lo&&L<=up){F[0]+=D[i*4];F[1]+=D[i*4+1];F[2]+=D[i*4+2];nf++;}}
  F[0]/=nf;F[1]/=nf;F[2]/=nf;
  const Fl=.2126*F[0]+.7152*F[1]+.0722*F[2],Fr=lin[Math.round(F[0])],Fg=lin[Math.round(F[1])],Fb=lin[Math.round(F[2])],FL=.2126*Fr+.7152*Fg+.0722*Fb;
  const satF=(Math.max(...F)-Math.min(...F))/(Math.max(...F)+1);
  /* 2) cor-alvo com um piso de luz ambiente (nenhum tecido real é 0% refletivo) */
  const Cl=Tl.map(v=>v*.97+.009),dark=1-Math.min(1,Tlum*5);
  let sOld=0,sNew=0;
  for(let i=0;i<n;i++){
    let w=M[i]/255;if(w<.01)continue;
    const j=i*4,r=D[j],g=D[j+1],b=D[j+2],L=.2126*r+.7152*g+.0722*b,mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=(mx-mn)/(mx+1),Lf=L/Fl;
    // proteção: pele, cabelo, jeans, céu e reflexos estourados não são tecido branco
    w*=(1-sm(satF+satG[0],satF+satG[1],sat))*sm(.1,.28,Lf)*(1-sm(hi[0],hi[1],Lf));
    if(w<.01)continue;
    const rl=lin[r],gl=lin[g],bl=lin[b];
    let Lr=(.2126*rl+.7152*gl+.0722*bl)/FL;if(Lr>1.7)Lr=1.7;
    const sr=Lr+(rl/Fr-Lr)*.5,sg=Lr+(gl/Fg-Lr)*.5,sb=Lr+(bl/Fb-Lr)*.5;        // mantém metade do tom da luz da cena
    const spec=gloss*sm(.97,1.13,Lr)*(1-.55*Tlum)+dark*sheen*Lr*Lr*Lr;       // brilho do esmalte / "sheen" do tecido escuro
    const nr=toS(Cl[0]*sr+spec),ng=toS(Cl[1]*sg+spec),nb=toS(Cl[2]*sb+spec);
    sOld+=L*w;sNew+=(.2126*nr+.7152*ng+.0722*nb)*w;
    D[j]=r+(nr-r)*w;D[j+1]=g+(ng-g)*w;D[j+2]=b+(nb-b)*w;
  }
  return sOld>0?sNew/sOld:1;
}
/* máscara do produto (arquivo na pasta mascaras de cada produto), em cache; null se não existir */
const masks=new Map();
function loadMask(url){
  if(!masks.has(url))masks.set(url,new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=url;}));
  return masks.get(url);
}
/* desenha a máscara com a transformação dada e devolve o canal vermelho */
function maskPixels(img,W,H,draw){
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});
  g.fillStyle='#000';g.fillRect(0,0,W,H);g.imageSmoothingQuality='high';draw(g,img);
  const d=g.getImageData(0,0,W,H).data,M=new Uint8Array(W*H);for(let i=0;i<M.length;i++)M[i]=d[i*4];return M;
}
return {PALETA,recolor,loadMask,maskPixels,lumOf};
})();
