'use strict';
/* App: biblioteca unificada (camisetas, ecobags e canecas), arte compartilhada, exportação e projetos */
const THEMES=[
  {id:'natal',label:'Natal',icon:'🎄',tags:'papai noel arvore presente neve lareira'},
  {id:'pascoa',label:'Páscoa',icon:'🐰',tags:'coelho ovos chocolate'},
  {id:'aniversario',label:'Aniversário',icon:'🎂',tags:'festa bolo parabens balao'},
  {id:'anonovo',label:'Ano Novo',icon:'🥂',tags:'reveillon virada champanhe fogos'},
  {id:'amor',label:'Amor e Mães',icon:'💖',tags:'namorados coracao dia das maes mae casamento rosas flores'},
  {id:'halloween',label:'Halloween',icon:'🎃',tags:'abobora morcego bruxa terror'},
  {id:'infantil',label:'Infantil',icon:'🧸',tags:'criancas dia das criancas brinquedo ursinho'},
  {id:'cinema',label:'Cinema',icon:'🎬',tags:'filme pipoca serie'},
  {id:'mistico',label:'Zen e Místico',icon:'🧘',tags:'espiritual buda lotus cristais astrologia signos meditacao'},
  {id:'musica',label:'Reggae e Música',icon:'🎵',tags:'reggae rasta violao percussao'},
  {id:'verao',label:'Ar livre e Verão',icon:'🏖️',tags:'praia mar sol jardim natureza varanda'},
  {id:'casa',label:'Casa e Aconchego',icon:'🏡',tags:'sala mesa lareira manta cafe'},
  {id:'escritorio',label:'Escritório',icon:'💼',tags:'trabalho home office mesa agenda'},
  {id:'moda',label:'Moda e Executivo',icon:'👔',tags:'executivo executiva terno blazer social profissional trabalho mulher homem estilo'},
  {id:'livre',label:'Fundo livre',icon:'🎨',tags:'sem fundo recorte transparente mao mãos personalizado cor cena'}
];
const GCATS={
  masculina:{label:'Camisetas masculinas',short:'Masculinas',icon:'👕',tags:'camiseta camisa masculina homem'},
  feminina:{label:'Camisetas femininas',short:'Femininas',icon:'👚',tags:'camiseta camisa feminina mulher'},
  ecobag:{label:'Ecobags',short:'Ecobags',icon:'👜',tags:'sacola bolsa tote ecobag'},
  dupla:{label:'Camisetas em dupla',short:'Duplas',icon:'👫',tags:'camisetas casal dupla'}};
const GROUPS=[...Object.entries(GCATS).map(([id,g])=>({id,...g,kind:'g'})),...THEMES.map(t=>({...t,kind:'m'}))];
const ITEMS={},ORDER=[];
CENARIOS.forEach(c=>{const k='g'+p2(c.id);ITEMS[k]={key:k,kind:'g',id:c.id,cat:c.tipo,name:c.nome,thumb:`assets/thumbs/cena-${p2(c.id)}.webp`};ORDER.push(k);});
Object.keys(CANECAS_META).sort((a,b)=>CANECAS_META[a].order-CANECAS_META[b].order).forEach(k=>{
  ITEMS[k]={key:k,kind:'m',cat:'caneca',theme:CANECAS_META[k].theme,name:CANECAS_SCENES[k].name,thumb:CANECAS_META[k].thumb};ORDER.push(k);});
const groupOf=k=>{const it=ITEMS[k];return it.kind==='g'?GROUPS.find(g=>g.kind==='g'&&g.id===it.cat):GROUPS.find(g=>g.kind==='m'&&g.id===it.theme);};
const hay=k=>{const g=groupOf(k);return norm(ITEMS[k].name+' '+g.label+' '+(g.tags||'')+(ITEMS[k].kind==='m'?' caneca canecas xicara':''));};

const wrap=$('wrap'),gallery=$('sceneGallery'),chipsEl=$('chips'),themesEl=$('themes'),searchInput=$('searchInput'),searchBox=$('searchBox');
const pill=$('scenePill'),pillIc=$('pillIc'),pillName=$('pillName'),counter=$('counter'),favBtn=$('favBtn');
let mode='g',active=null,query='',seq=0,filt=store.get('filt','todos'),sub=store.get('sub',null);
const favs=new Set(store.get('favs',[]));
try{JSON.parse(localStorage.favCenas||'[]').forEach(i=>favs.add('g'+p2(i)));localStorage.removeItem('favCenas');}catch(e){}
[...favs].forEach(k=>{if(!ITEMS[k])favs.delete(k);});
const saveFavs=()=>store.set('favs',[...favs]);
saveFavs();

/* ---------- filtros e lista visível ---------- */
function visible(){
  if(query){const q=norm(query).split(/\s+/).filter(Boolean);return ORDER.filter(k=>{const h=hay(k);return q.every(w=>h.includes(w));});}
  if(filt==='favoritos')return ORDER.filter(k=>favs.has(k));
  if(filt==='todos')return ORDER;
  if(filt==='caneca')return ORDER.filter(k=>ITEMS[k].kind==='m'&&(!sub||ITEMS[k].theme===sub));
  return ORDER.filter(k=>ITEMS[k].cat===filt);
}
const navList=()=>{const v=visible();return v.includes(active)?v:ORDER;};
function renderChips(){
  const cnt=f=>f==='todos'?ORDER.length:f==='favoritos'?favs.size:ORDER.filter(k=>ITEMS[k].cat===f).length;
  const list=[{id:'todos',label:'Todos',icon:'✨'}];
  if(favs.size||filt==='favoritos')list.push({id:'favoritos',label:'Favoritos',icon:'❤️',cls:'fav-chip'});
  Object.entries(GCATS).forEach(([id,g])=>list.push({id,label:g.short,icon:g.icon}));list.push({id:'caneca',label:'Canecas',icon:'☕'});
  chipsEl.innerHTML=list.map(t=>{const on=!query&&t.id===filt;
    return `<button type="button" class="chip ${t.cls||''} ${on?'active':''}" data-f="${t.id}" aria-pressed="${on}"><span class="ic">${t.icon}</span>${t.label}<span class="n">${cnt(t.id)}</span></button>`;}).join('');
  const showSub=!query&&filt==='caneca';themesEl.classList.toggle('on',showSub);
  if(showSub){const mk=ORDER.filter(k=>ITEMS[k].kind==='m');
    themesEl.innerHTML=[{id:'',label:'Todos os temas',icon:'✨',n:mk.length},...THEMES.map(t=>({...t,n:mk.filter(k=>ITEMS[k].theme===t.id).length}))].filter(t=>t.n).map(t=>{const on=(sub||'')===t.id;
      return `<button type="button" class="chip ${on?'active':''}" data-s="${t.id}"><span class="ic">${t.icon}</span>${t.label}<span class="n">${t.n}</span></button>`;}).join('');}
  [chipsEl,themesEl].forEach(c=>{const a=c.querySelector('.chip.active');if(a)requestAnimationFrame(()=>a.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'}));});
}
function thumbEl(k,i){
  const it=ITEMS[k],b=document.createElement('button');b.type='button';b.className='thumb'+(k===active?' active':'');b.dataset.key=k;
  b.style.setProperty('--i',Math.min(i,16));b.setAttribute('aria-label',it.name);if(k===active)b.setAttribute('aria-current','true');
  const f=favs.has(k);
  b.innerHTML=`<span class="im"><img alt="" src="${it.thumb}" loading="lazy" decoding="async" draggable="false"></span><span class="cap">${esc(it.name)}</span><span class="tick">✓</span><span class="fv${f?' on':''}" data-fv role="button" aria-label="Favoritar">${f?'♥':'♡'}</span>`;
  return b;
}
function renderGrid(){
  const keys=visible();
  $('sceneCount').textContent=keys.length===ORDER.length?ORDER.length+' cenários':keys.length+' de '+ORDER.length;
  gallery.innerHTML='';
  if(!keys.length){
    gallery.innerHTML=query?`<div class="empty"><b>🔍</b>Nenhum cenário para “${esc(query)}”.<br><button type="button" data-act="clear">Limpar busca</button></div>`
      :`<div class="empty"><b>🤍</b>Você ainda não favoritou cenários.<br>Toque no coração na pré-visualização.<br><button type="button" data-act="all">Ver todos</button></div>`;
    return;
  }
  const frag=document.createDocumentFragment();let i=0;
  if(filt==='todos'&&!query&&!mqDock.matches){
    GROUPS.forEach(g=>{const ks=keys.filter(k=>groupOf(k)===g);if(!ks.length)return;
      const h=document.createElement('div');h.className='gh';
      h.innerHTML=`<span>${g.icon}</span>${g.label}<small>${ks.length}</small><button type="button" data-f="${g.kind==='g'?g.id:'caneca'}" data-s="${g.kind==='m'?g.id:''}">ver só este</button>`;frag.appendChild(h);
      ks.forEach(k=>frag.appendChild(thumbEl(k,i++)));});
  }else keys.forEach(k=>frag.appendChild(thumbEl(k,i++)));
  gallery.appendChild(frag);gallery.scrollTo({left:0,top:0,behavior:'auto'});
  const act=gallery.querySelector('.thumb.active');if(act)requestAnimationFrame(()=>act.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'}));
}
function updateStage(animate=true){
  if(!active)return;
  const g=groupOf(active),list=navList(),i=list.indexOf(active);
  pillIc.textContent=g.icon;pillName.textContent=ITEMS[active].name;
  if(animate){pill.classList.remove('swap');void pill.offsetWidth;pill.classList.add('swap');}
  counter.textContent=(i+1)+' / '+list.length;
  const f=favs.has(active);favBtn.classList.toggle('on',f);favBtn.setAttribute('aria-pressed',f);
  document.querySelectorAll('.thumb').forEach(el=>{const on=el.dataset.key===active;el.classList.toggle('active',on);on?el.setAttribute('aria-current','true'):el.removeAttribute('aria-current');});
  const a=gallery.querySelector('.thumb.active');if(a)a.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
}
function selectFilter(f,s=null){
  filt=f;sub=s||null;query='';searchInput.value='';searchBox.classList.remove('has');store.set('filt',f);store.set('sub',sub);
  renderChips();renderGrid();updateStage(false);
}
function clearSearch(){query='';searchInput.value='';searchBox.classList.remove('has');renderChips();renderGrid();updateStage(false);}
function syncFav(k){
  document.querySelectorAll(`.thumb[data-key="${k}"] .fv`).forEach(el=>{const f=favs.has(k);el.classList.toggle('on',f);el.textContent=f?'♥':'♡';});
}
function toggleFav(k=active){
  if(!k)return;
  if(favs.has(k)){favs.delete(k);toast('Removido dos favoritos');}else{favs.add(k);toast('❤️ Adicionado aos favoritos');}
  saveFavs();renderChips();
  if(filt==='favoritos'&&!query)renderGrid();else syncFav(k);
  updateStage(false);
}

/* ---------- troca de cenário: escolhe o motor certo (camiseta/ecobag ou caneca) ---------- */
function setMode(m){
  mode=m;document.body.dataset.mode=m;
  if(m==='g')wrap.classList.remove('transp');
  refreshArtChip();
}
async function load(key){
  const it=ITEMS[key];if(!it)return false;
  const my=++seq;active=key;store.set('scene',key);
  setMode(it.kind);updateStage();pushColor(key);wrap.classList.add('loading');await nextFrame();
  const ok=it.kind==='g'?await Garment.load(it.id):await Mug.loadScene(key);
  if(my!==seq)return false;
  wrap.classList.remove('loading');
  if(!ok){toast('Não foi possível carregar este cenário.');return false;}
  renderColorUI();if(it.kind==='g')autoModo(CORES[prodOf(key)]||null,true);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)(it.kind==='g'?$('preview'):$('mockup')).animate([{opacity:.35,transform:'scale(1.025)',filter:'blur(5px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});
  return true;
}
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
function go(d){const list=navList();if(list.length<2)return;let i=list.indexOf(active);i=(i+d+list.length)%list.length;load(list[i]);}
function randomScene(){
  const pool=ORDER.filter(k=>k!==active),k=pool[Math.floor(Math.random()*pool.length)];
  if(!visible().includes(k)&&!query){filt='todos';sub=null;store.set('filt','todos');renderChips();renderGrid();}
  load(k);toast('🎲 '+ITEMS[k].name);
}

/* ---------- eventos da biblioteca ---------- */
gallery.addEventListener('click',e=>{
  const gb=e.target.closest('.gh button');if(gb){selectFilter(gb.dataset.f,gb.dataset.s);return;}
  const act=e.target.closest('[data-act]');if(act){act.dataset.act==='clear'?clearSearch():selectFilter('todos');return;}
  const th=e.target.closest('.thumb');if(!th)return;
  if(e.target.closest('[data-fv]')){e.stopPropagation();toggleFav(th.dataset.key);return;}
  ripple(th,e);if(th.dataset.key!==active)load(th.dataset.key);
});
gallery.addEventListener('pointerover',e=>{const t=e.target.closest('.thumb');if(t&&ITEMS[t.dataset.key].kind==='g')new Image().src=`assets/cena-${p2(ITEMS[t.dataset.key].id)}.webp`;});
chipsEl.addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;ripple(c,e);selectFilter(c.dataset.f,c.dataset.f==='caneca'?sub:null);});
themesEl.addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;ripple(c,e);selectFilter('caneca',c.dataset.s);});
let searchTimer=null;
searchInput.addEventListener('input',()=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{query=searchInput.value.trim();searchBox.classList.toggle('has',!!searchInput.value);renderChips();renderGrid();updateStage(false);},120);
  searchBox.classList.toggle('has',!!searchInput.value);
});
$('searchClear').addEventListener('click',()=>{clearSearch();searchInput.focus();});
$('prevBtn').addEventListener('click',()=>go(-1));
$('nextBtn').addEventListener('click',()=>go(1));
$('randomBtn').addEventListener('click',randomScene);
favBtn.addEventListener('click',()=>toggleFav());
/* deslizar na pré-visualização (celular) */
(()=>{let sx=0,sy=0,t0=0,on=false;
  wrap.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||mode!=='m')return;on=true;sx=e.clientX;sy=e.clientY;t0=performance.now();});
  wrap.addEventListener('pointerup',e=>{if(!on)return;on=false;const dx=e.clientX-sx,dy=e.clientY-sy;
    if(Math.abs(dx)>56&&Math.abs(dx)>Math.abs(dy)*1.6&&performance.now()-t0<700)go(dx<0?1:-1);});
  wrap.addEventListener('pointercancel',()=>on=false);
})();



/* ---------- galeria expandida ---------- */
const gm=$('galleryModal'),gmScroll=$('gmScroll'),gmIndex=$('gmIndex'),gmSearch=$('gmSearch');
let gmObserver=null;
function buildModal(){
  const q=norm(gmSearch.value.trim()).split(/\s+/).filter(Boolean),match=k=>!q.length||q.every(w=>hay(k).includes(w));
  const secs=[];
  if(favs.size)secs.push({id:'favoritos',label:'Favoritos',icon:'❤️',keys:ORDER.filter(k=>favs.has(k)&&match(k))});
  GROUPS.forEach(g=>secs.push({id:g.kind+'-'+g.id,label:g.label,icon:g.icon,keys:ORDER.filter(k=>groupOf(k)===g&&match(k))}));
  const vis=secs.filter(s=>s.keys.length);let total=0;vis.forEach(s=>{if(s.id!=='favoritos')total+=s.keys.length;});
  $('gmCount').textContent=total+' cenários';
  gmIndex.innerHTML=vis.map(s=>`<button type="button" class="chip" data-target="gm-${s.id}"><span class="ic">${s.icon}</span>${s.label}<span class="n">${s.keys.length}</span></button>`).join('');
  gmScroll.innerHTML='';
  if(!vis.length){gmScroll.innerHTML='<div class="gm-empty"><b>🔍</b>Nenhum cenário encontrado.</div>';return;}
  let i=0;
  vis.forEach(s=>{const sec=document.createElement('section');sec.className='gm-sec';sec.id='gm-'+s.id;
    sec.innerHTML=`<h3><span>${s.icon}</span>${s.label}<small>${s.keys.length}</small></h3>`;
    const grid=document.createElement('div');grid.className='gm-grid';s.keys.forEach(k=>grid.appendChild(thumbEl(k,i++%12)));
    sec.appendChild(grid);gmScroll.appendChild(sec);});
  if(gmObserver)gmObserver.disconnect();
  gmObserver=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){gmIndex.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c.dataset.target===en.target.id));
    const a=gmIndex.querySelector('.chip.active');if(a)a.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});}});},{root:gmScroll,rootMargin:'-8% 0px -82% 0px'});
  gmScroll.querySelectorAll('.gm-sec').forEach(s=>gmObserver.observe(s));
}
function openGallery(){gmSearch.value='';$('gmSearchBox').classList.remove('has');buildModal();gm.classList.add('on');gm.setAttribute('aria-hidden','false');document.body.classList.add('gm-open');
  setTimeout(()=>{const a=gmScroll.querySelector('.thumb.active');if(a)a.scrollIntoView({block:'center',behavior:'auto'});},60);}
function closeGallery(){gm.classList.remove('on');gm.setAttribute('aria-hidden','true');document.body.classList.remove('gm-open');}
$('expandBtn').addEventListener('click',openGallery);
$('gmClose').addEventListener('click',closeGallery);
gmIndex.addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;ripple(c,e);document.getElementById(c.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});});
gmScroll.addEventListener('click',e=>{const t=e.target.closest('.thumb');if(!t)return;
  if(e.target.closest('[data-fv]')){toggleFav(t.dataset.key);return;}
  ripple(t,e);closeGallery();if(t.dataset.key!==active)load(t.dataset.key);});
let gmTimer=null;gmSearch.addEventListener('input',()=>{$('gmSearchBox').classList.toggle('has',!!gmSearch.value);clearTimeout(gmTimer);gmTimer=setTimeout(buildModal,120);});
$('gmSearchClear').addEventListener('click',()=>{gmSearch.value='';$('gmSearchBox').classList.remove('has');buildModal();gmSearch.focus();});
(()=>{
  const sp=$('splitter'),root=document.documentElement,lib=document.querySelector('.library');
  const clampW=w=>Math.max(330,Math.min(w,Math.min(980,innerWidth*0.62)));
  const apply=w=>{root.style.setProperty('--libw',clampW(w)+'px');};
  const saved=store.get('libw',null);if(saved)apply(saved);
  let drag=false;
  sp.addEventListener('pointerdown',e=>{drag=true;sp.setPointerCapture(e.pointerId);sp.classList.add('drag');document.body.classList.add('resizing');});
  sp.addEventListener('pointermove',e=>{if(!drag)return;const r=lib.getBoundingClientRect();apply(r.right-e.clientX);});
  const end=e=>{if(!drag)return;drag=false;sp.classList.remove('drag');document.body.classList.remove('resizing');store.set('libw',Math.round(lib.getBoundingClientRect().width));};
  sp.addEventListener('pointerup',end);sp.addEventListener('pointercancel',end);
  sp.addEventListener('dblclick',()=>{root.style.removeProperty('--libw');store.set('libw',null);toast('Largura da galeria restaurada');});
  sp.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();const w=lib.getBoundingClientRect().width+(e.key==='ArrowLeft'?32:-32);apply(w);store.set('libw',Math.round(clampW(w)));});
})();


/* ---------- arte compartilhada: a mesma estampa vale para camisetas, ecobags e canecas ---------- */
let userArt=null,exG=null,exM=null;
function refreshArtChip(){
  const img=userArt?userArt.img:(mode==='g'?exG:exM);
  $('artChip').classList.toggle('on',!!img);if(img)$('artThumb').src=img.src;
  $('artName').textContent=userArt?userArt.name:'Arte de exemplo';
  $('artClear').style.display=userArt?'':'none';
}
function applyUserArt(img,name,blob){
  userArt={img,name,blob};Garment.setArt(img);Mug.setArt(img,name,false,mode!=='m');refreshArtChip();
  if(mode==='g')toast('Arte aplicada ✓');if(mqDock.matches)closePanel();
}
async function resetArt(quiet){
  userArt=null;$('artInput').value='';Garment.setArt(exG);Mug.setArt(exM,'arte de exemplo',true,true);refreshArtChip();if(!quiet)toast('Arte de exemplo restaurada');
}
async function useFile(f){
  if(!f)return;
  if(!/^image\//.test(f.type)&&!/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name))return toast('Escolha uma imagem PNG, JPG ou WebP.');
  if(f.size>40e6)return toast('Arquivo acima de 40 MB.');
  try{const i=new Image();i.src=URL.createObjectURL(f);await i.decode();applyUserArt(i,f.name,f);saveEst(f);}
  catch(e){toast('Não foi possível abrir essa imagem. Tente PNG ou JPG.');}
}
$('artInput').addEventListener('change',e=>useFile(e.target.files?.[0]));
$('uploadTop').addEventListener('click',()=>$('artInput').click());
$('resetBtn').addEventListener('click',()=>resetArt());$('artClear').addEventListener('click',()=>resetArt());
['dragenter','dragover'].forEach(ev=>wrap.addEventListener(ev,e=>{e.preventDefault();wrap.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>wrap.addEventListener(ev,e=>{e.preventDefault();wrap.classList.remove('drag');}));
wrap.addEventListener('drop',e=>useFile(e.dataTransfer.files?.[0]));

/* ---------- exportação: PNG, JPG, copiar e ZIP em lote (os dois produtos) ---------- */
const dlBtn=$('downloadBtn'),caretBtn=$('exportCaret'),exportMenu=$('exportMenu');
let outFmt=store.get('fmt','png');if(outFmt!=='png'&&outFmt!=='jpg')outFmt='png';
const slug=s=>norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const blobNow=type=>mode==='g'?Garment.blob(type):Mug.blob(type);
const pxNow=()=>mode==='g'?Garment.size():Mug.size();
function syncFmt(){
  $('fmtLabel').textContent=outFmt.toUpperCase();
  $('pngS').textContent=mode==='g'?pxNow()+' × '+pxNow()+' · tamanho definido em Exportação':'1800 × 1800 · máxima qualidade';
  exportMenu.querySelectorAll('[data-act="png"],[data-act="jpg"]').forEach(b=>b.classList.toggle('cur',b.dataset.act===outFmt));
}
function saveBlob(b,name){const a=document.createElement('a');a.download=name;a.href=URL.createObjectURL(b);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
const fileName=(ext)=>`almatie-${mode==='g'?slug(ITEMS[active].name):active}-${pxNow()}px${mode==='g'&&ext==='png'&&$('expArt').checked?'-estampa':''}.${ext}`;
async function doDownload(type=outFmt){
  if(dlBtn.classList.contains('busy'))return;dlBtn.classList.add('busy');
  try{const b=await blobNow(type);if(!b)throw 0;saveBlob(b,fileName(type));dlBtn.classList.add('done');toast(`Mockup baixado ✓ · ${type.toUpperCase()} ${pxNow()} × ${pxNow()}`);setTimeout(()=>dlBtn.classList.remove('done'),1800);}
  catch(e){toast('Este tamanho é grande demais para o aparelho. Escolha um menor em Exportação.');}
  dlBtn.classList.remove('busy');
}
async function copyImage(){
  try{const b=await blobNow('png');await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);toast('Imagem copiada ✓ · é só colar');}
  catch(e){toast('Não foi possível copiar aqui. Use Baixar.');}
}
const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc32=u8=>{let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=crcT[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
async function buildZip(files){
  const enc=new TextEncoder(),parts=[],central=[];let offset=0;const d=new Date();
  const dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate(),tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1);
  for(const f of files){
    const data=new Uint8Array(await f.blob.arrayBuffer()),name=enc.encode(f.name),crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(10,tm,true);h.setUint16(12,dt,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);
    parts.push(h.buffer,name,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(12,tm,true);c.setUint16(14,dt,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
    central.push(c.buffer,name);offset+=30+name.length+data.length;
  }
  let cs=0;central.forEach(b=>cs+=b.byteLength);
  const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,offset,true);
  return new Blob([...parts,...central,e.buffer],{type:'application/zip'});
}

let batchStop=false,batchBusy=false;
async function exportBatch(keys,label){
  if(batchBusy)return;if(!keys.length){toast('Nenhum cenário nesta seleção.');return;}
  batchBusy=true;batchStop=false;const keep=active,files=[],box=$('batch');
  $('batchTitle').textContent='Gerando '+keys.length+' mockups…';box.hidden=false;
  for(let i=0;i<keys.length&&!batchStop;i++){
    $('batchInfo').textContent=`${i+1} de ${keys.length} · ${ITEMS[keys[i]].name}`;$('batchBar').style.width=(i/keys.length*100)+'%';
    if(!await load(keys[i]))continue;await nextFrame();
    const b=await blobNow(outFmt);if(b)files.push({name:`${p2(i+1)}-${slug(ITEMS[keys[i]].name)}.${outFmt}`,blob:b});
  }
  $('batchBar').style.width='100%';
  if(!batchStop&&files.length){$('batchTitle').textContent='Compactando…';const z=await buildZip(files);saveBlob(z,`almatie-mockups-${slug(label)}.zip`);toast(`ZIP pronto ✓ · ${files.length} mockups`);}
  box.hidden=true;batchBusy=false;
  if(keep&&keep!==active)await load(keep);
}
$('batchCancel').addEventListener('click',()=>{batchStop=true;});
function openMenu(){
  const g=groupOf(active),gk=ORDER.filter(k=>groupOf(k)===g);
  $('zipThemeT').textContent=`Baixar ${g.label} (ZIP)`;$('zipThemeS').textContent=gk.length+' mockups com a sua arte';
  $('zipFavS').textContent=favs.size?favs.size+' mockups favoritados':'Favorite cenários com ♥ para usar';
  exportMenu.querySelector('[data-act="zip-favs"]').disabled=!favs.size;
  $('zipAllS').textContent=ORDER.length+' mockups · pode levar alguns minutos';
  syncFmt();exportMenu.hidden=false;caretBtn.setAttribute('aria-expanded','true');
}
function closeMenu(){exportMenu.hidden=true;caretBtn.setAttribute('aria-expanded','false');}
dlBtn.addEventListener('click',()=>doDownload());
caretBtn.addEventListener('click',e=>{e.stopPropagation();exportMenu.hidden?openMenu():closeMenu();});
document.addEventListener('click',e=>{if(!exportMenu.hidden&&!e.target.closest('#exportWrap'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!exportMenu.hidden){closeMenu();caretBtn.focus();}},true);
exportMenu.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const a=b.dataset.act;closeMenu();
  if(a==='png'||a==='jpg'){outFmt=a;store.set('fmt',a);syncFmt();doDownload(a);}
  else if(a==='copy')copyImage();
  else if(a==='zip-theme'){const g=groupOf(active);exportBatch(ORDER.filter(k=>groupOf(k)===g),g.label);}
  else if(a==='zip-favs')exportBatch(ORDER.filter(k=>favs.has(k)),'favoritos');
  else if(a==='zip-all')exportBatch(ORDER.slice(),'todos');
});
$('expSize').addEventListener('change',syncFmt);

/* ---------- projetos salvos e biblioteca de estampas (IndexedDB do navegador) ---------- */
const DB=new Promise((ok,ko)=>{const r=indexedDB.open('almatie',1);r.onupgradeneeded=()=>{r.result.createObjectStore('projetos',{keyPath:'id'});r.result.createObjectStore('estampas',{keyPath:'id'});};r.onsuccess=()=>ok(r.result);r.onerror=ko;});
const db=(st,m,f)=>DB.then(d=>new Promise((ok,ko)=>{const t=d.transaction(st,m),r=f(t.objectStore(st));t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>ko(t.error);}));
const saveEst=async f=>{try{const id=f.name+'|'+f.size,old=await db('estampas','readonly',s=>s.get(id));await db('estampas','readwrite',s=>s.put({id,nome:f.name,blob:f,fav:old?old.fav:false,t:Date.now()}));}catch(e){}};
let tab='p';
async function dlg(){
  const d=$('dlg'),b=$('dbody');document.querySelectorAll('#dtabs button').forEach(x=>x.classList.toggle('on',x.dataset.t===tab));
  if(tab==='p'){
    const l=(await db('projetos','readonly',s=>s.getAll())).sort((a,c)=>c.t-a.t);
    b.innerHTML=`<div class="row"><input id="pn" placeholder="Nome do projeto" value="${esc(userArt?userArt.name.replace(/\.[^.]+$/,''):'Meu projeto')}"><button class="btn primary" id="ps" type="button">Salvar projeto atual</button></div><div class="cards">${l.map(p=>`<div class="card"><img src="${p.thumb}" alt=""><b>${esc(p.nome)}</b><small>${new Date(p.t).toLocaleString('pt-BR')}</small><div><button class="btn ghost" data-o="${p.id}" type="button">Abrir</button> <button class="btn ghost" data-x="${p.id}" type="button">Excluir</button></div></div>`).join('')||'<p class="hint">Nenhum projeto salvo ainda.</p>'}</div>`;
    $('ps').onclick=async()=>{
      const t=document.createElement('canvas');t.width=t.height=240;t.getContext('2d').drawImage(mode==='g'?$('preview'):$('mockup'),0,0,240,240);
      await db('projetos','readwrite',s=>s.put({id:Date.now(),nome:$('pn').value||'Projeto',key:active,mode,state:mode==='g'?{P:Garment.getState()}:Mug.getState(),cor:{prod:prodOf(active),hex:CORES[prodOf(active)]||null,parte:corParte,tinta:corTinta},arte:userArt?userArt.blob:null,thumb:t.toDataURL('image/jpeg',.7),t:Date.now()}));
      toast('Projeto salvo ✓');dlg();};
    b.onclick=async e=>{
      const o=e.target.dataset.o,x=e.target.dataset.x;
      if(x){await db('projetos','readwrite',s=>s.delete(+x));dlg();}
      if(o){
        const p=await db('projetos','readonly',s=>s.get(+o));d.close();
        const k0=p.key||('g'+p2(p.cena));if(p.cor){CORES[p.cor.prod]=p.cor.hex;corParte=p.cor.parte||'all';corTinta=p.cor.tinta||'auto';store.set('cores',CORES);store.set('parte',corParte);store.set('tinta',corTinta);}
        await load(k0);
        if(p.arte){const i=new Image();i.src=URL.createObjectURL(p.arte);await i.decode();applyUserArt(i,p.arte.name||'arte',p.arte);}else await resetArt(true);
        const st=p.state||{P:p.P};if(ITEMS[active].kind==='g')Garment.setState(st.P);else Mug.setState(st);
        toast('Projeto aberto ✓');
      }};
  }else{
    const l=(await db('estampas','readonly',s=>s.getAll())).sort((a,c)=>(c.fav-a.fav)||c.t-a.t);
    b.innerHTML=`<div class="cards">${l.map(p=>`<div class="card"><img src="${URL.createObjectURL(p.blob)}" alt="" data-u="${esc(p.id)}"><b>${esc(p.nome)}</b><div><button class="btn ghost" data-f="${esc(p.id)}" type="button">${p.fav?'★ Favorita':'☆ Favoritar'}</button> <button class="btn ghost" data-x="${esc(p.id)}" type="button">Excluir</button></div></div>`).join('')||'<p class="hint">As estampas que você enviar ficam guardadas aqui.</p>'}</div>`;
    b.onclick=async e=>{
      const t=e.target.dataset,r=id=>db('estampas','readonly',s=>s.get(id));
      if(t.f){const p=await r(t.f);p.fav=!p.fav;await db('estampas','readwrite',s=>s.put(p));dlg();}
      else if(t.x){await db('estampas','readwrite',s=>s.delete(t.x));dlg();}
      else if(t.u){const p=await r(t.u);d.close();await useFile(new File([p.blob],p.nome,{type:p.blob.type}));}
    };
  }
  if(!d.open)d.showModal();
}
$('projBtn').onclick=()=>{tab='p';dlg();};$('dx').onclick=()=>$('dlg').close();
document.querySelectorAll('#dtabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;dlg();});

/* ---------- cor do produto (camiseta, ecobag e caneca) ---------- */
const CORES=store.get('cores',{});
let corParte=store.get('parte','all'),corTinta=store.get('tinta','auto'),autoOp=false;
const prodOf=k=>ITEMS[k].kind==='m'?'caneca':ITEMS[k].cat==='ecobag'?'ecobag':'camiseta';
const isDark=h=>!!h&&Cor.lumOf(h)<.12;
function pushColor(key){                                 // entrega ao motor a cor do produto do cenário
  const it=ITEMS[key],hex=CORES[prodOf(key)]||null;
  if(it.kind==='g')Garment.setTint(hex,true);
  else Mug.setColor(hex,corParte,!!hex&&(corTinta==='opq'||(corTinta==='auto'&&isDark(hex))));
}
function autoModo(hex,silent){                           // cores escuras: tinta multiply some; a estampa precisa ser opaca
  const sel=$('modo');
  if(isDark(hex)&&sel.value==='mult'){sel.value='op';sel.dispatchEvent(new Event('change'));autoOp=true;if(!silent)toast('Cor escura: estampa opaca ativada');}
  else if(!isDark(hex)&&autoOp&&sel.value==='op'){sel.value='mult';sel.dispatchEvent(new Event('change'));autoOp=false;}
}
function buildSwatches(){
  $('colorSw').innerHTML=Cor.PALETA.map(c=>`<button type="button" class="${c.hex?'':'orig'}" data-hex="${c.hex||''}" style="--c:${c.hex||'#fff'}" title="${c.nome}" aria-label="${c.nome}"></button>`).join('');
}
function renderColorUI(){
  const prod=prodOf(active),hex=CORES[prod]||'';
  $('colorLbl').textContent='Cor da '+prod;
  $('colorSw').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.hex===hex));
  if(hex)$('colorPick').value=hex;
  $('mugColorOpts').hidden=!(prod==='caneca'&&hex);$('mugPart').value=corParte;$('mugInk').value=corTinta;
  $('colorHint').textContent=prod==='caneca'?'Preserva o brilho do esmalte e as sombras da foto. “Só alça e interior” mantém o corpo branco para a estampa.'
    :'Preserva dobras, sombras e textura do tecido da foto. Cada produto lembra a sua cor.';
}
async function chooseColor(hex){
  const prod=prodOf(active);CORES[prod]=hex;store.set('cores',CORES);renderColorUI();
  wrap.classList.add('loading');
  try{
    if(mode==='g'){const ok=await Garment.setTint(hex);if(!ok&&hex){CORES[prod]=null;store.set('cores',CORES);renderColorUI();toast('Cor indisponível neste cenário.');}else autoModo(hex);}
    else{pushColor(active);await Mug.refresh();}
  }finally{wrap.classList.remove('loading');}
}
$('colorSw').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;ripple(b,e);chooseColor(b.dataset.hex||null);});
let pickT=null;$('colorPick').addEventListener('input',e=>{clearTimeout(pickT);pickT=setTimeout(()=>chooseColor(e.target.value),140);});
$('mugPart').addEventListener('change',e=>{corParte=e.target.value;store.set('parte',corParte);pushColor(active);Mug.refresh();});
$('mugInk').addEventListener('change',e=>{corTinta=e.target.value;store.set('tinta',corTinta);pushColor(active);Mug.refresh();});

/* ---------- teclado ---------- */
document.addEventListener('keydown',e=>{
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)&&document.activeElement.type!=='range';
  if(e.key==='Escape'){
    if(gm.classList.contains('on')){closeGallery();return;}
    if(panel.classList.contains('open')){closePanel();return;}
    if(document.activeElement===searchInput){if(searchInput.value)clearSearch();else searchInput.blur();}
    return;
  }
  if(typing||e.metaKey||e.ctrlKey||e.altKey)return;
  const nudge=mode==='g'&&Garment.sel();                     // com a estampa selecionada, as setas movem a arte
  if(e.key==='ArrowRight'&&!nudge){e.preventDefault();go(1);}
  else if(e.key==='ArrowLeft'&&!nudge){e.preventDefault();go(-1);}
  else if(e.key==='PageDown'){e.preventDefault();go(1);}
  else if(e.key==='PageUp'){e.preventDefault();go(-1);}
  else if(e.key==='/'){e.preventDefault();searchInput.focus();searchInput.select();}
  else if(e.key==='f'||e.key==='F')toggleFav();
  else if(e.key==='r'||e.key==='R')randomScene();
  else if(e.key==='g'||e.key==='G')gm.classList.contains('on')?closeGallery():openGallery();
  else if((e.key==='m'||e.key==='M')&&mode==='m')Mug.toggleMirror();
},true);

/* ---------- início ---------- */
(async()=>{
  Mug.init();buildSwatches();
  try{exG=await Garment.demo();Garment.setArt(exG);exM=await Mug.useDefault();}catch(e){console.error(e);}
  refreshArtChip();
  if(filt==='favoritos'&&!favs.size)filt='todos';
  let first=store.get('scene',ORDER[0]);if(!ITEMS[first])first=ORDER[0];
  active=first;renderChips();renderGrid();syncFmt();await load(first);
})();
