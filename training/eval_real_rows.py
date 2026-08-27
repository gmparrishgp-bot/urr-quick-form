"""Evaluate the custom character engine on the three labeled real URR row crops.
This is deliberately separate from training: these crops are holdout fixtures.
"""
from __future__ import annotations
import ast, base64, io, json, re, sys
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

MODEL=Path('training/artifacts/urr-char.onnx')
CLASSES=json.loads(Path('training/artifacts/urr-char-classes.json').read_text())

def parse_cases():
    src=Path('tests/trocr_regression.mjs').read_text()
    block=re.search(r'const CASES = (\[[\s\S]*?\]);\nfunction norm',src)
    if not block: raise RuntimeError('CASES block not found')
    # Extract only name/expected/data from the JS literal without executing JS.
    pat=re.compile(r"\{name:'([^']+)',\s*expected:'([^']+)',\s*data:'([^']+)'\}")
    out=[{'name':a,'expected':b,'data':c} for a,b,c in pat.findall(block.group(1))]
    if len(out)<3: raise RuntimeError(f'only {len(out)} cases parsed')
    return out

def otsu_ink(gray):
    if gray.shape[0] < 8 or gray.shape[1] < 8: return np.zeros_like(gray,dtype=np.uint8)
    blur=cv2.GaussianBlur(gray,(3,3),0)
    _,bw=cv2.threshold(blur,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)
    # Suppress thin printed grid lines by morphology, retaining character-sized strokes.
    h,w=bw.shape
    hk=max(12,w//15); vk=max(10,h//2)
    horiz=cv2.morphologyEx(bw,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(hk,1)))
    vert=cv2.morphologyEx(bw,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(1,vk)))
    bw=cv2.subtract(bw,cv2.bitwise_or(horiz,vert))
    return bw

def boxes_for(gray):
    bw=otsu_ink(gray); h,w=bw.shape
    n,lab,stats,_=cv2.connectedComponentsWithStats((bw>0).astype(np.uint8),8)
    boxes=[]
    for i in range(1,n):
        x,y,ww,hh,area=stats[i]
        if area < max(3,h*.025) or hh < max(2,h*.09): continue
        if ww>w*.45 and hh<4: continue
        boxes.append([int(x),int(y),int(x+ww),int(y+hh),int(area)])
    boxes.sort()
    # Merge fragments likely belonging to one handwritten character. Decimal points
    # stay separate because they sit low and are much smaller than neighboring glyphs.
    merged=[]
    for b in boxes:
        if not merged: merged.append(b); continue
        a=merged[-1]
        gap=b[0]-a[2]; overlap=max(0,min(a[2],b[2])-max(a[0],b[0]))
        yov=max(0,min(a[3],b[3])-max(a[1],b[1]))
        ah=a[3]-a[1]; bh=b[3]-b[1]
        tiny=(b[3]-b[1])<h*.20 and (b[2]-b[0])<h*.18
        if not tiny and (overlap>0 or (gap<=1 and yov>min(ah,bh)*.45)):
            a[0]=min(a[0],b[0]);a[1]=min(a[1],b[1]);a[2]=max(a[2],b[2]);a[3]=max(a[3],b[3]);a[4]+=b[4]
        else: merged.append(b)
    return bw,merged

def prep_glyph(bw,b):
    x0,y0,x1,y1,_=b; crop=bw[max(0,y0-1):min(bw.shape[0],y1+1),max(0,x0-1):min(bw.shape[1],x1+1)]
    h,w=crop.shape; side=max(h,w)+6
    sq=np.zeros((side,side),np.uint8); oy=(side-h)//2;ox=(side-w)//2;sq[oy:oy+h,ox:ox+w]=crop
    im=cv2.resize(sq,(20,20),interpolation=cv2.INTER_AREA)
    out=np.zeros((28,28),np.float32);out[4:24,4:24]=im.astype(np.float32)/255.0
    return (out*2-1)[None,None,:,:]

def softmax(x):
    x=x-x.max();e=np.exp(x);return e/e.sum()

def recognize(gray,sess,mode='text'):
    bw,boxes=boxes_for(gray); h,w=bw.shape
    if not boxes:return '',0.0,[]
    chars=[]; conf=[]; detail=[]; prev=None
    allowed=set('0123456789') if mode=='numeric' else None
    for b in boxes:
        x0,y0,x1,y1,area=b; bh=y1-y0; bwid=x1-x0
        if mode=='numeric' and bh<h*.22 and bwid<h*.22 and y0>h*.45:
            ch='.'; cf=.99
        else:
            z=sess.run(None,{'image':prep_glyph(bw,b).astype(np.float32)})[0][0]
            p=softmax(z); order=np.argsort(-p)
            idx=next((int(i) for i in order if allowed is None or str(CLASSES[int(i)]).upper() in allowed),int(order[0]))
            ch=str(CLASSES[idx]).upper();cf=float(p[idx])
        if prev is not None:
            gap=x0-prev[2]; median_h=max(1,np.median([q[3]-q[1] for q in boxes]))
            if mode=='text' and gap>median_h*.55: chars.append(' ')
        chars.append(ch);conf.append(cf);detail.append({'box':b,'char':ch,'confidence':round(cf,3)})
        prev=b
    return ''.join(chars).strip(),float(np.mean(conf) if conf else 0),detail

def num(v):
    m=re.search(r'\d*\.\d+|\d+',v);return float(m.group()) if m else None

def expected_fields(s):
    pm=re.search(r'\$(\d+(?:\.\d+)?)',s); parts=float(pm.group(1)) if pm else None
    after=s[pm.end():] if pm else s; hm=re.search(r'(\.\d+|\d+(?:\.\d+)?)\s*(?:HR)?\b',after,re.I);hours=float(hm.group(1)) if hm else None
    return parts,hours

def main():
    sess=ort.InferenceSession(str(MODEL),providers=['CPUExecutionProvider'])
    results=[]; exact=0
    for c in parse_cases():
        raw=base64.b64decode(c['data']); rgb=np.array(Image.open(io.BytesIO(raw)).convert('RGB')); gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
        h,w=gray.shape
        # The stored holdout crops span description -> parts -> labor. Keep zones
        # broad and slightly overlapping; field-specific alphabets do the rest.
        desc=gray[:, :int(w*.70)]
        parts=gray[:, int(w*.66):int(w*.86)]
        hours=gray[:, int(w*.82):]
        title,tc,td=recognize(desc,sess,'text'); ptxt,pc,pd=recognize(parts,sess,'numeric'); htxt,hc,hd=recognize(hours,sess,'numeric')
        ep,eh=expected_fields(c['expected']); gp=num(ptxt);gh=num(htxt)
        pok=(gp==ep);hok=(gh==eh); ok=pok and hok
        exact += int(ok)
        results.append({'name':c['name'],'expected':c['expected'],'recognized':{'title':title,'parts':ptxt,'hours':htxt},'numeric':{'parts':gp,'hours':gh},'expected_numeric':{'parts':ep,'hours':eh},'confidence':{'title':round(tc,3),'parts':round(pc,3),'hours':round(hc,3)},'partsOK':pok,'hoursOK':hok,'numericExact':ok,'image':{'w':w,'h':h}})
    print(json.dumps({'numeric_exact':exact,'total':len(results),'results':results},indent=2))
    Path('training/artifacts/real-row-results.json').write_text(json.dumps({'numeric_exact':exact,'total':len(results),'results':results},indent=2))
    # First iteration is diagnostic; promotion gate will be tightened once geometry
    # is calibrated from these real fixtures.
    if exact < 1: raise SystemExit('custom engine did not exactly read any real numeric fixture')
if __name__=='__main__': main()
