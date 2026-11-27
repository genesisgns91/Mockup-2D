// Importa máscaras feitas por IA: a IA devolve a MESMA foto com o produto pintado de magenta chapado (#FF00FF).
// A máscara sai da cor magenta; o alinhamento com a foto original é automático (o resto da imagem é igual).
// Uso:  cd tools && npm i && node importar_mascaras.js        (lê tools/ia/*.png|jpg|webp)
//   nomes: cena-14.png (camiseta/ecobag nº 14)  ·  natal.png (caneca "natal")
//   --revisao grava tools/ia/revisao/*.jpg (foto + máscara em verde) para você conferir antes de publicar
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const SITE=path.resolve(process.env.SITE||path.join(__dirname,'..')),IA=process.env.IA||path.join(__dirname,'ia');
const REV=process.argv.includes('--revisao');
let CAN={};try{CAN=new (require('vm').Script)(fs.readFileSync(path.join(SITE,'data/canecas.js'),'utf8')+';CANECAS_SCENES').runInNewContext({});}catch(e){}
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const BG=[238,232,237];
async function readRGB(buf,W,H){                       // sempre sobre o fundo neutro do site, no tamanho do original
  let p=sharp(buf).ensureAlpha();if(W)p=p.resize(W,H,{fit:'fill'});
  const {data,info}=await p.raw().toBuffer({resolveWithObject:true}),n=info.width*info.height,rgb=Buffer.alloc(n*3);
  for(let i=0;i<n;i++){const a=data[i*4+3]/255;for(let c=0;c<3;c++)rgb[i*3+c]=Math.round(data[i*4+c]*a+BG[c]*(1-a));}
  return {rgb,W:info.width,H:info.height};
}
const gray=(rgb,n)=>{const g=new Float32Array(n);for(let i=0;i<n;i++)g[i]=.299*rgb[i*3]+.587*rgb[i*3+1]+.114*rgb[i*3+2];return g;};
async function half(rgb,W,H){const {data}=await sharp(rgb,{raw:{width:W,height:H,channels:3}}).resize(W>>1,H>>1,{kernel:'cubic'}).raw().toBuffer({resolveWithObject:true});return {data,w:W>>1,h:H>>1};}
(async()=>{
  const files=fs.existsSync(IA)?fs.readdirSync(IA).filter(f=>/\.(png|jpe?g|webp)$/i.test(f)):[];
  if(!files.length){console.log('Coloque as imagens devolvidas pela IA em tools/ia/ (ex.: cena-14.png) e rode de novo.');return;}
  if(REV)fs.mkdirSync(path.join(IA,'revisao'),{recursive:true});
  for(const f of files){
    const base=f.replace(/\.\w+$/,''),isG=/^cena-\d+$/.test(base);
    const orig=isG?path.join(SITE,`assets/${base}.webp`):CAN[base]&&path.join(SITE,CAN[base].src);
    const out=isG?path.join(SITE,`assets/mascaras/${base}.webp`):path.join(SITE,`assets/canecas/mascaras/${base}.webp`);
    if(!orig||!fs.existsSync(orig)){console.log('PULEI',f,'(não achei o cenário correspondente)');continue;}
    const o=await readRGB(orig),meta=await sharp(path.join(IA,f)).metadata();
    if(Math.abs(meta.width/meta.height-o.W/o.H)>.02)console.log('AVISO',f,`proporção diferente (${meta.width}×${meta.height} vs ${o.W}×${o.H}): a IA cortou ou esticou a imagem; confira a revisão`);
    const a=await readRGB(path.join(IA,f),o.W,o.H),n=o.W*o.H;
    // 1) pontuação de magenta: R e B altos, G baixo
    const sc=new Float32Array(n);for(let i=0;i<n;i++)sc[i]=Math.min(a.rgb[i*3],a.rgb[i*3+2])-a.rgb[i*3+1];
    let pb=false;{let k=0;for(let i=0;i<n;i+=7)if(sc[i]>100)k++;if(k<n/7*0.002){pb=true;console.log('AVISO',f,'não achei magenta: usando como máscara preto e branco (branco = produto), sem alinhamento automático');for(let i=0;i<n;i++)sc[i]=(a.rgb[i*3]+a.rgb[i*3+1]+a.rgb[i*3+2])/3;}}
    // 2) alinhamento: procura o deslocamento que mais aproxima a IA do original fora da área magenta (meia resolução)
    const ho=await half(o.rgb,o.W,o.H),ha=await half(a.rgb,o.W,o.H),w=ho.w,h=ho.h,go=gray(ho.data,w*h),ga=gray(ha.data,w*h);
    const keep=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)keep[y*w+x]=pb?0:(sc[(y*2)*o.W+x*2]<25?1:0);
    let best=[0,0],bs=1e18;const R=pb?0:12;
    for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){let s=0,c=0;for(let y=R;y<h-R;y+=2)for(let x=R;x<w-R;x+=2){const i=y*w+x;if(keep[i]){s+=Math.abs(go[i]-ga[(y+dy)*w+x+dx]);c++;}}s/=Math.max(c,1);if(s<bs){bs=s;best=[dx,dy];}}
    const sx=best[0]*2,sy=best[1]*2;                         // deslocamento da IA em relação ao original (px, resolução cheia)
    // 3) máscara (já deslocada de volta), suavizada
    const m=Buffer.alloc(n);
    for(let y=0;y<o.H;y++)for(let x=0;x<o.W;x++){const xs=x+sx,ys=y+sy;m[y*o.W+x]=(xs<0||ys<0||xs>=o.W||ys>=o.H)?0:Math.round(255*smooth(55,150,sc[ys*o.W+xs]));}
    const clean=await sharp(m,{raw:{width:o.W,height:o.H,channels:1}}).median(5).blur(.9).extractChannel(0).raw().toBuffer();
    fs.mkdirSync(path.dirname(out),{recursive:true});
    await sharp(clean,{raw:{width:o.W,height:o.H,channels:1}}).webp({quality:82,smartSubsample:false}).toFile(out);
    let cov=0;for(let i=0;i<n;i++)if(clean[i]>128)cov++;
    console.log('OK',f,'→',path.relative(SITE,out),`| área ${(100*cov/n).toFixed(1)}% | deslocamento corrigido ${sx},${sy}px`);
    if(REV){const v=Buffer.from(o.rgb);for(let i=0;i<n;i++){const k=clean[i]/255*.6;v[i*3]=v[i*3]*(1-k);v[i*3+1]=v[i*3+1]*(1-k)+200*k;v[i*3+2]=v[i*3+2]*(1-k);}
      await sharp(v,{raw:{width:o.W,height:o.H,channels:3}}).resize(900).jpeg({quality:85}).toFile(path.join(IA,'revisao',base+'.jpg'));}
  }
})();
