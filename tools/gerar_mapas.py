#!/usr/bin/env python3
"""Gera data/cenarios.js: mapa individual de cada cenário (zona de impressão + calibração).
Uso: python3 tools/gerar_mapas.py [--debug]  (requer opencv-python, numpy, pillow)
Para ajustar um cenário na mão, edite o campo "zona" ou "dobra" no cenarios.js gerado
(ou crie tools/ajustes.json: {"24": {"zona":[x,y,w,h]}} — sobrescreve a detecção)."""
import cv2, numpy as np, json, re, sys, os
from PIL import Image
ROOT=os.path.join(os.path.dirname(__file__),'..')
html=open(os.path.join(ROOT,'tools/origem_v10.html'),encoding='utf-8').read()
scenes=json.loads(re.search(r'const SCENES=(\[.*?\]);',html,re.S).group(1))
zones={int(k):v for k,v in json.loads(re.search(r'const PRINT_ZONES=(\{.*?\});',html,re.S).group(1)).items()}
adj=json.load(open(os.path.join(ROOT,'tools/ajustes.json'))) if os.path.exists(os.path.join(ROOT,'tools/ajustes.json')) else {}
out=[];dbg=[]
for s in scenes:
    i=s['id'];rgba=Image.open(os.path.join(ROOT,s['src'])).convert('RGBA');bg=Image.new('RGBA',rgba.size,(238,232,237,255));alpha=np.array(rgba)[:,:,3];img=np.array(Image.alpha_composite(bg,rgba).convert('RGB'));H,W=img.shape[:2]
    lab=cv2.cvtColor(cv2.GaussianBlur(img,(0,0),2),cv2.COLOR_RGB2LAB).astype(np.float32)
    z0=zones[i];zx,zy,zw,zh=z0;ex=[max(0,zx-zw*.16),max(0,zy-zh*.16),min(1,zx+zw*1.16),min(1,zy+zh*1.16)]  # área expandida (v10)
    cx,cy=int((zx+zw/2)*W),int((zy+zh/2)*H);r=int(min(zw,zh)*W*.15)
    seed=lab[cy-r:cy+r,cx-r:cx+r].reshape(-1,3);med=np.median(seed,0)
    # tecido = pixels com cor próxima da do tecido (croma baixo/semelhante) e luz acima de um piso, conectados ao centro
    d=np.abs(lab[:,:,1:]-med[1:]).sum(2);ok=((d<16)&(lab[:,:,0]>med[0]-70)).astype(np.uint8)
    ok=ok&(cv2.erode((alpha>250).astype(np.uint8),np.ones((15,15),np.uint8)));ok=cv2.morphologyEx(ok,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
    n,lbl=cv2.connectedComponents(ok);mask=(lbl==lbl[cy,cx]).astype(np.uint8) if lbl[cy,cx] else ok
    x0,y0,x1,y1=[int(v) for v in (ex[0]*W,ex[1]*H,ex[2]*W,ex[3]*H)]
    ii=cv2.integral(mask)
    cov=lambda a,b,c,d_:(ii[d_,c]-ii[b,c]-ii[d_,a]+ii[b,a])/max(1,(c-a)*(d_-b))
    for _ in range(400):  # encolhe o retângulo pelo lado mais "sujo" até caber no tecido
        if cov(x0,y0,x1,y1)>=.985:break
        sides={'l':cov(x0,y0,x0+8,y1),'r':cov(x1-8,y0,x1,y1),'t':cov(x0,y0,x1,y0+8),'b':cov(x0,y1-8,x1,y1)}
        k=min(sides,key=sides.get)
        if k=='l':x0+=4
        elif k=='r':x1-=4
        elif k=='t':y0+=4
        else:y1-=4
        if x1-x0<W*.1 or y1-y0<H*.1:break
    zona=[x0/W,y0/H,(x1-x0)/W,(y1-y0)/H]
    if str(i) in adj and 'zona' in adj[str(i)]:zona=adj[str(i)]['zona']
    # calibração de luz: luminância do tecido na zona, alta frequência = energia das dobras
    L=cv2.cvtColor(img,cv2.COLOR_RGB2GRAY).astype(np.float32)[y0:y1,x0:x1];low=cv2.GaussianBlur(L,(0,0),18)
    hf=float(np.std((L-low)/np.maximum(low,40)));ref=float(np.percentile(low,75))
    out.append(dict(id=i,tipo=s['type'],nome=s['name'],zona=[round(v,4) for v in zona],ref=round(ref,1),
        dobra=int(np.clip(45+hf*600,45,90)),escuro=bool(ref<110)))
    if '--debug' in sys.argv:
        t=img.copy();t[mask==0]=(t[mask==0]*.45).astype(np.uint8);cv2.rectangle(t,(x0,y0),(x1,y1),(255,0,90),6);dbg.append(cv2.resize(t,(300,300)))
    o=out[-1];o.update(adj.get(str(i),{}))
open(os.path.join(ROOT,'data/cenarios.js'),'w',encoding='utf-8').write('const CENARIOS='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';')
print(len(out),'cenários mapeados; calibração média dobra=',np.mean([o['dobra'] for o in out]))
if dbg:
    cols=10;rows=(len(dbg)+cols-1)//cols;sh=np.zeros((rows*300,cols*300,3),np.uint8)
    for k,t in enumerate(dbg):sh[(k//cols)*300:(k//cols+1)*300,(k%cols)*300:(k%cols+1)*300]=t
    Image.fromarray(sh).resize((cols*150,rows*150)).save('/home/claude/debug.jpg',quality=82)
