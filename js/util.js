'use strict';
/* Utilitários compartilhados pelos dois motores (camisetas/ecobags e canecas) */
const $=id=>document.getElementById(id);
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const store={get(k,d){try{const v=localStorage.getItem('almatie.'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem('almatie.'+k,JSON.stringify(v));}catch(e){}}};
function toast(msg,ms=2300){
  const box=$('toasts'),t=document.createElement('div');t.className='toast';t.textContent=msg;box.appendChild(t);
  while(box.children.length>2)box.firstChild.remove();
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320);},ms);
}
function ripple(el,e){
  const r=el.getBoundingClientRect(),d=document.createElement('span');d.className='rp';
  d.style.left=((e.clientX||r.left+r.width/2)-r.left)+'px';d.style.top=((e.clientY||r.top+r.height/2)-r.top)+'px';
  el.appendChild(d);setTimeout(()=>d.remove(),650);
}
/* painel de personalização (gaveta no celular) */
const mqDock=matchMedia('(max-width:1179px)'),panel=$('panel'),backdrop=$('backdrop');
function openPanel(){panel.classList.add('open');backdrop.classList.add('on');}
function closePanel(){panel.classList.remove('open');backdrop.classList.remove('on');}
$('customizeBtn').addEventListener('click',openPanel);
$('closePanel').addEventListener('click',closePanel);
backdrop.addEventListener('click',closePanel);
mqDock.addEventListener?.('change',()=>closePanel());
