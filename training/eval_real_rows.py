"""End-to-end holdout evaluation for the custom URR handwriting engine.

The real URR crops are NEVER training data.  They are the release gate.  Numeric
fields are read by the dedicated MNIST model; descriptions are read by the EMNIST
character model.  The evaluator reports every critical field instead of allowing a
weak smoke test to masquerade as a useful reader.
"""
from __future__ import annotations
import base64, io, json, re
from difflib import SequenceMatcher
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

CHAR_MODEL=Path('training/artifacts/urr-char.onnx')
NUM_MODEL=Path('training/artifacts/urr-numeric.onnx')
CLASSES=json.loads(Path('training/artifacts/urr-char-classes.json').read_text())

def parse_cases():
    src=Path('tests/trocr_regression.mjs').read_text()
    block=re.search(r'const CASES = (\[[\s\S]*?\]);\nfunction norm',src)
    if not block: raise RuntimeError('CASES block not found')
    pat=re.compile(r"\{name:'([^']+)',\s*expected:'([^']+)',\s*data:'([^']+)'\}")
    out=[{'name':a,'expected':b,'data':c} for a,b,c in pat.findall(block.group(1))]
    if len(out)<3: raise RuntimeError(f'only {len(out)} real holdout cases parsed')
    return out

def otsu_ink(gray):
    if gray.shape[0] < 8 or gray.shape[1] < 8: return np.zeros_like(gray,dtype=np.uint8)
    blur=cv2.GaussianBlur(gray,(3,3),0)
    _,bw=cv2.threshold(blur,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)
    h,w=bw.shape
    hk=max(12,w//15); vk=max(10,h//2)
    horiz=cv2.morphologyEx(bw,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(hk,1)))
    vert=cv2.morphologyEx(bw,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(1,vk)))
    return cv2.subtract(bw,cv2.bitwise_or(horiz,vert))

def boxes_for(gray):
    bw=otsu_ink(gray); h,w=bw.shape
    n,_,stats,_=cv2.connectedComponentsWithStats((bw>0).astype(np.uint8),8)
    boxes=[]
    for i in range(1,n):
        x,y,ww,hh,area=stats[i]
        if area < max(3,h*.025) or hh < max(2,h*.09): continue
        if ww>w*.45 and hh<4: continue
        boxes.append([int(x),int(y),int(x+ww),int(y+hh),int(area)])
    boxes.sort()
    merged=[]
    for b in boxes:
        if not merged: merged.append(b); continue
        a=merged[-1]; gap=b[0]-a[2]
        overlap=max(0,min(a[2],b[2])-max(a[0],b[0])); yov=max(0,min(a[3],b[3])-max(a[1],b[1]))
        ah=a[3]-a[1]; bh=b[3]-b[1]
        tiny=bh<h*.20 and (b[2]-b[0])<h*.18
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

def recognize(gray,char_sess,num_sess,mode='text'):
    bw,boxes=boxes_for(gray); h,_=bw.shape
    if not boxes:return '',0.0,[]
    chars=[]; conf=[]; detail=[]; prev=None
    for b in boxes:
        x0,y0,x1,y1,_=b; bh=y1-y0; bwid=x1-x0
        if mode=='numeric' and bh<h*.22 and bwid<h*.22 and y0>h*.45:
            ch='.'; cf=.99; engine='geometry'
        else:
            sess=num_sess if mode=='numeric' else char_sess
            z=sess.run(None,{'image':prep_glyph(bw,b).astype(np.float32)})[0][0]
            p=softmax(z); order=np.argsort(-p)
            if mode=='numeric': idx=int(order[0]); ch=str(idx); engine='numeric'
            else:
                idx=next((int(i) for i in order if str(CLASSES[int(i)]).upper().isalnum()),int(order[0]))
                ch=str(CLASSES[idx]).upper(); engine='char'
            cf=float(p[idx])
        if prev is not None:
            gap=x0-prev[2]; median_h=max(1,np.median([q[3]-q[1] for q in boxes]))
            if mode=='text' and gap>median_h*.55: chars.append(' ')
        chars.append(ch);conf.append(cf);detail.append({'box':b,'char':ch,'confidence':round(cf,3),'engine':engine});prev=b
    return ''.join(chars).strip(),float(np.mean(conf) if conf else 0),detail

def first_num(v):
    m=re.search(r'\d*\.\d+|\d+',v);return float(m.group()) if m else None

def expected_fields(s):
    pm=re.search(r'\$(\d+(?:\.\d+)?)',s); parts=float(pm.group(1)) if pm else None
    desc=(s[:pm.start()] if pm else s).strip()
    after=s[pm.end():] if pm else s
    hm=re.search(r'(\.\d+|\d+(?:\.\d+)?)\s*(?:HR)?\b',after,re.I);hours=float(hm.group(1)) if hm else None
    return desc,parts,hours

def norm_text(s): return re.sub(r'[^A-Z0-9]+',' ',s.upper()).strip()
def text_score(got,want): return SequenceMatcher(None,norm_text(got),norm_text(want)).ratio()

def main():
    missing=[str(p) for p in (CHAR_MODEL,NUM_MODEL) if not p.exists()]
    if missing: raise SystemExit('missing trained model(s): '+', '.join(missing))
    char_sess=ort.InferenceSession(str(CHAR_MODEL),providers=['CPUExecutionProvider'])
    num_sess=ort.InferenceSession(str(NUM_MODEL),providers=['CPUExecutionProvider'])
    results=[]; numeric_fields_ok=0; numeric_fields_total=0; numeric_rows_ok=0; text_scores=[]
    for c in parse_cases():
        raw=base64.b64decode(c['data']); rgb=np.array(Image.open(io.BytesIO(raw)).convert('RGB')); gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
        _,w=gray.shape
        desc=gray[:, :int(w*.70)]; parts=gray[:, int(w*.66):int(w*.86)]; hours=gray[:, int(w*.82):]
        title,tc,_=recognize(desc,char_sess,num_sess,'text'); ptxt,pc,_=recognize(parts,char_sess,num_sess,'numeric'); htxt,hc,_=recognize(hours,char_sess,num_sess,'numeric')
        ed,ep,eh=expected_fields(c['expected']); gp=first_num(ptxt); gh=first_num(htxt)
        pok=(gp==ep); hok=(gh==eh); rowok=pok and hok
        numeric_fields_ok += int(pok)+int(hok); numeric_fields_total += 2; numeric_rows_ok += int(rowok)
        ts=text_score(title,ed); text_scores.append(ts)
        results.append({'name':c['name'],'expected':{'description':ed,'parts':ep,'hours':eh},'recognized':{'description':title,'parts_raw':ptxt,'hours_raw':htxt,'parts':gp,'hours':gh},'pass':{'parts':pok,'hours':hok,'numericRow':rowok},'description_similarity':round(ts,3),'confidence':{'description':round(tc,3),'parts':round(pc,3),'hours':round(hc,3)}})
    avg_text=float(np.mean(text_scores)) if text_scores else 0
    summary={'numeric_fields_exact':numeric_fields_ok,'numeric_fields_total':numeric_fields_total,'numeric_rows_exact':numeric_rows_ok,'rows_total':len(results),'description_similarity_avg':round(avg_text,3),'results':results}
    print(json.dumps(summary,indent=2)); Path('training/artifacts/real-row-results.json').write_text(json.dumps(summary,indent=2))
    # Release gate: numeric values drive pricing and cannot be guessed.  At least five
    # of six critical real-sheet numeric fields must be exact during development.
    # Production promotion remains stricter: all six plus acceptable descriptions.
    if numeric_fields_ok < 5: raise SystemExit(f'real URR numeric gate failed: {numeric_fields_ok}/{numeric_fields_total} exact')
    if avg_text < .45: raise SystemExit(f'real URR description gate failed: average similarity {avg_text:.3f}')
if __name__=='__main__': main()
