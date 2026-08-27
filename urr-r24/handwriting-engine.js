"use strict";
// R24: local, trainable URR handwriting recognizer.
// Description fields use the EMNIST character model; RO/parts/hours use the
// dedicated numeric model so alphabet ambiguity cannot contaminate number reads.
(function(){
  let ort=null,charSession=null,numericSession=null,classes=null,readyPromise=null;
  const CHAR_MODEL="training/artifacts/urr-char.onnx";
  const NUMERIC_MODEL="training/artifacts/urr-numeric.onnx";
  const CLASSFILE="training/artifacts/urr-char-classes.json";
  const numericMode=m=>m==="parts"||m==="hours"||m==="total"||m==="ro";

  function softmax(a){let m=-Infinity;for(const v of a)if(v>m)m=v;let s=0;const e=new Float32Array(a.length);for(let i=0;i<a.length;i++){e[i]=Math.exp(a[i]-m);s+=e[i];}for(let i=0;i<e.length;i++)e[i]/=s;return e;}
  function allowed(mode,ch){ch=String(ch||"").toUpperCase();if(numericMode(mode))return /^[0-9]$/.test(ch);return /^[A-Z0-9]$/.test(ch);}
  async function init(){
    if(charSession&&classes)return true;
    if(readyPromise)return readyPromise;
    readyPromise=(async()=>{
      ort=await import("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/+esm");
      classes=await fetch(CLASSFILE,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("URR character map missing");return r.json();});
      const opts={executionProviders:navigator.gpu?["webgpu","wasm"]:["wasm"],graphOptimizationLevel:"all"};
      charSession=await ort.InferenceSession.create(CHAR_MODEL,opts);
      // Numeric model is intentionally optional during training iterations. Once the
      // artifact exists it is always preferred for numeric fields; otherwise the
      // character model remains a temporary fallback rather than breaking the UI.
      try{numericSession=await ort.InferenceSession.create(NUMERIC_MODEL,opts);}catch(e){console.warn("URR numeric model not ready; using character fallback",e);numericSession=null;}
      return true;
    })().catch(e=>{readyPromise=null;throw e;});
    return readyPromise;
  }
  function imageFromURL(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error("Could not open URR field crop"));im.src=url;});}
  function otsu(hist,total){let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sumB=0,wB=0,best=160,bestVar=-1;for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=t*hist[t];const mB=sumB/wB,mF=(sum-sumB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>bestVar){bestVar=v;best=t;}}return Math.max(70,Math.min(225,best));}
  function binaryFromImage(im){
    const c=document.createElement("canvas");c.width=im.naturalWidth||im.width;c.height=im.naturalHeight||im.height;const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(im,0,0,c.width,c.height);
    const d=ctx.getImageData(0,0,c.width,c.height).data,hist=new Uint32Array(256);for(let i=0;i<d.length;i+=4){const g=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);hist[g]++;}
    const th=otsu(hist,c.width*c.height),ink=new Uint8Array(c.width*c.height);for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,g=.299*d[i]+.587*d[i+1]+.114*d[i+2];if(g<th)ink[y*c.width+x]=1;}
    const row=new Uint32Array(c.height),col=new Uint32Array(c.width);for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(ink[y*c.width+x]){row[y]++;col[x]++;}
    for(let y=0;y<c.height;y++)if(row[y]>c.width*.72)for(let yy=Math.max(0,y-1);yy<=Math.min(c.height-1,y+1);yy++)for(let x=0;x<c.width;x++)ink[yy*c.width+x]=0;
    for(let x=0;x<c.width;x++)if(col[x]>c.height*.72)for(let xx=Math.max(0,x-1);xx<=Math.min(c.width-1,x+1);xx++)for(let y=0;y<c.height;y++)ink[y*c.width+xx]=0;
    return{ink,w:c.width,h:c.height};
  }
  function segments(bin){
    const {ink,w,h}=bin,proj=new Uint32Array(w);let ymin=h,ymax=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(ink[y*w+x]){proj[x]++;if(y<ymin)ymin=y;if(y>ymax)ymax=y;}
    if(ymax<0)return[];const active=[];let start=-1;for(let x=0;x<=w;x++){const on=x<w&&proj[x]>0;if(on&&start<0)start=x;if(!on&&start>=0){active.push([start,x-1]);start=-1;}}
    const joined=[];for(const g of active){const p=joined[joined.length-1];if(p&&g[0]-p[1]<=2)p[1]=g[1];else joined.push(g.slice());}
    const height=Math.max(1,ymax-ymin+1),out=[];
    for(const g of joined){const width=g[1]-g[0]+1;if(width>height*1.25){const target=Math.max(2,Math.round(width/(height*.62)));let a=g[0];for(let n=1;n<target;n++){const nominal=Math.round(g[0]+width*n/target),r=Math.max(2,Math.round(width*.10));let cut=nominal,best=Infinity;for(let x=Math.max(a+2,nominal-r);x<=Math.min(g[1]-2,nominal+r);x++)if(proj[x]<best){best=proj[x];cut=x;}out.push([a,cut-1]);a=cut;}out.push([a,g[1]]);}else out.push(g);}
    return out.map(g=>{let y0=h,y1=-1,area=0;for(let x=g[0];x<=g[1];x++)for(let y=0;y<h;y++)if(ink[y*w+x]){if(y<y0)y0=y;if(y>y1)y1=y;area++;}return{x0:g[0],x1:g[1],y0,y1,area};}).filter(b=>b.area>=3&&b.y1>=b.y0);
  }
  function glyphTensor(bin,b){
    const {ink,w}=bin,gw=b.x1-b.x0+1,gh=b.y1-b.y0+1,side=Math.max(gw,gh)+6,src=new Float32Array(side*side),ox=Math.floor((side-gw)/2),oy=Math.floor((side-gh)/2);
    for(let y=0;y<gh;y++)for(let x=0;x<gw;x++)if(ink[(b.y0+y)*w+(b.x0+x)])src[(oy+y)*side+(ox+x)]=1;
    const out=new Float32Array(28*28);out.fill(-1);for(let yy=4;yy<24;yy++)for(let xx=4;xx<24;xx++){const sx=Math.min(side-1,Math.floor((xx-4)*side/20)),sy=Math.min(side-1,Math.floor((yy-4)*side/20));out[yy*28+xx]=src[sy*side+sx]?1:-1;}return out;
  }
  async function inferGlyphs(mode,glyphs,indexes){
    if(!indexes.length)return new Map();
    const useNumeric=numericMode(mode)&&numericSession, sess=useNumeric?numericSession:charSession;
    const data=new Float32Array(indexes.length*28*28);indexes.forEach((idx,n)=>data.set(glyphs[idx],n*28*28));
    const input=new ort.Tensor("float32",data,[indexes.length,1,28,28]),output=await sess.run({image:input}),z=output[sess.outputNames[0]].data,nc=useNumeric?10:classes.length,results=new Map();
    indexes.forEach((idx,n)=>{const row=z.slice(n*nc,(n+1)*nc),p=softmax(row);let pick;if(useNumeric){pick=[...p.keys()].sort((a,b)=>p[b]-p[a])[0];results.set(idx,{ch:String(pick),conf:p[pick],engine:"numeric"});return;}const order=[...p.keys()].sort((a,b)=>p[b]-p[a]);pick=order.find(k=>allowed(mode,classes[k]));if(pick==null)pick=order[0];results.set(idx,{ch:String(classes[pick]).toUpperCase(),conf:p[pick],engine:"char"});});
    return results;
  }
  async function readCrop(crop){
    await init();const im=await imageFromURL(crop.url),bin=binaryFromImage(im),segs=segments(bin);if(!segs.length)return{text:"",confidence:0,detail:[]};
    const mode=crop.mode||"description",glyphs=[],isDot=[];for(const b of segs){const bh=b.y1-b.y0+1,bw=b.x1-b.x0+1,dot=(mode==="hours"||mode==="parts"||mode==="total")&&bh<bin.h*.22&&bw<bin.h*.22&&b.y0>bin.h*.42;isDot.push(dot);glyphs.push(glyphTensor(bin,b));}
    const normalIdx=isDot.map((v,i)=>v?-1:i).filter(i=>i>=0),results=await inferGlyphs(mode,glyphs,normalIdx);
    let text="",conf=[],prev=null;const heights=segs.map(b=>b.y1-b.y0+1).sort((a,b)=>a-b),mh=heights[Math.floor(heights.length/2)]||bin.h*.5,detail=[];for(let i=0;i<segs.length;i++){const b=segs[i],r=isDot[i]?{ch:".",conf:.99,engine:"geometry"}:results.get(i);if(!r)continue;if(prev&&mode.startsWith("description")&&b.x0-prev.x1>mh*.55)text+=" ";text+=r.ch;conf.push(r.conf);detail.push({char:r.ch,confidence:r.conf,engine:r.engine,box:b});prev=b;}
    return{text:text.trim(),confidence:conf.length?conf.reduce((a,b)=>a+b,0)/conf.length:0,detail};
  }
  async function readBatch(crops){const out=[];for(const c of crops)out.push((await readCrop(c)).text);return out;}
  window.URR_CHAR_ENGINE={init,readCrop,readBatch,models:{char:CHAR_MODEL,numeric:NUMERIC_MODEL}};
})();
