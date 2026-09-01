// Lot Walk Scanner v6: isolate handwritten numeric suffixes into individual glyphs before generic OCR.
(function(){
  const fallback=window.lotWalkScanSourceV5;
  let busy=false;

  function copy(source,max=1800){
    const sw=source.videoWidth||source.naturalWidth||source.width, sh=source.videoHeight||source.naturalHeight||source.height;
    if(!sw||!sh) throw Error('Image not ready');
    const s=Math.min(1,max/Math.max(sw,sh)), c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(sw*s)); c.height=Math.max(1,Math.round(sh*s));
    c.getContext('2d').drawImage(source,0,0,c.width,c.height); return c;
  }
  function rotate(src,deg){
    const q=Math.abs(deg)%180===90,c=document.createElement('canvas'); c.width=q?src.height:src.width; c.height=q?src.width:src.height;
    const x=c.getContext('2d'); x.fillStyle='white'; x.fillRect(0,0,c.width,c.height); x.translate(c.width/2,c.height/2); x.rotate(deg*Math.PI/180); x.drawImage(src,-src.width/2,-src.height/2); return c;
  }
  function threshold(src){
    const c=document.createElement('canvas'); c.width=src.width; c.height=src.height;
    const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(src,0,0);
    const im=x.getImageData(0,0,c.width,c.height),d=im.data,vals=[];
    for(let i=0;i<d.length;i+=16) vals.push(.299*d[i]+.587*d[i+1]+.114*d[i+2]);
    vals.sort((a,b)=>a-b); const q=p=>vals[Math.min(vals.length-1,Math.floor(vals.length*p))];
    const mean=vals.reduce((a,b)=>a+b,0)/vals.length, sd=Math.sqrt(vals.reduce((a,v)=>a+(v-mean)*(v-mean),0)/vals.length);
    // Actual lot chalk/marker is a small bright fraction of a very dark frame.
    const thr=Math.max(q(.91),mean+Math.max(8,.85*sd));
    const W=c.width,H=c.height,m=new Uint8Array(W*H);
    for(let p=0,i=0;i<d.length;i+=4,p++){const v=.299*d[i]+.587*d[i+1]+.114*d[i+2];m[p]=v>=thr?1:0;}
    // close small gaps in marker strokes (3x3 dilation then mild vertical closing)
    const out=new Uint8Array(m.length);
    for(let y=0;y<H;y++) for(let xx=0;xx<W;xx++){
      let on=0; for(let dy=-1;dy<=1&&!on;dy++) for(let dx=-1;dx<=1;dx++){const nx=xx+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<W&&ny<H&&m[ny*W+nx]){on=1;break;}}
      out[y*W+xx]=on;
    }
    return {W,H,m:out};
  }
  function components(bin){
    const {W,H,m}=bin,seen=new Uint8Array(m.length),comps=[];
    const stack=[];
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const s=y*W+x; if(!m[s]||seen[s]) continue;
      seen[s]=1; stack.length=0; stack.push(s); let minX=x,maxX=x,minY=y,maxY=y,n=0;
      while(stack.length){const p=stack.pop(),py=Math.floor(p/W),px=p-py*W;n++;if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const ni=ny*W+nx;if(m[ni]&&!seen[ni]){seen[ni]=1;stack.push(ni);}}
      }
      const w=maxX-minX+1,h=maxY-minY+1;
      if(n<12||h<H*.055||h>H*.72||w<2) continue;
      // remove long bright trim/reflection lines and huge blocks
      if(w/h>2.2||w>W*.45) continue;
      comps.push({x:minX,y:minY,w,h,n,cx:(minX+maxX)/2,cy:(minY+maxY)/2});
    }
    return comps;
  }
  function mergeFragments(cs){
    // Merge vertically split pieces belonging to the same handwritten glyph.
    const arr=cs.slice().sort((a,b)=>a.x-b.x),used=new Array(arr.length).fill(false),out=[];
    for(let i=0;i<arr.length;i++){
      if(used[i])continue; let a={...arr[i]}; used[i]=true;
      for(let j=i+1;j<arr.length;j++){
        if(used[j])continue; const b=arr[j];
        const overlap=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
        const xNear=overlap>Math.min(a.w,b.w)*.25||Math.abs(a.cx-b.cx)<Math.max(a.w,b.w)*.7;
        const gap=Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.h,b.y+b.h));
        if(xNear&&gap<Math.max(a.h,b.h)*.32){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),r=Math.max(a.x+a.w,b.x+b.w),bt=Math.max(a.y+a.h,b.y+b.h);a={x,y,w:r-x,h:bt-y,n:a.n+b.n,cx:(x+r)/2,cy:(y+bt)/2};used[j]=true;}
      }
      out.push(a);
    }
    return out;
  }
  function candidateLines(cs,W,H){
    const c=mergeFragments(cs).filter(a=>a.h>H*.08&&a.h<H*.62&&a.w/a.h<1.45),lines=[];
    for(const seed of c){
      const group=c.filter(a=>Math.abs(a.cy-seed.cy)<Math.max(a.h,seed.h)*.55 && a.h/seed.h>.42 && a.h/seed.h<2.35).sort((a,b)=>a.x-b.x);
      if(group.length<4)continue;
      for(let len=4;len<=Math.min(7,group.length);len++) for(let i=0;i+len<=group.length;i++){
        const g=group.slice(i,i+len),heights=g.map(a=>a.h),med=heights.slice().sort((a,b)=>a-b)[Math.floor(heights.length/2)];
        const gaps=[];for(let k=1;k<g.length;k++)gaps.push(g[k].x-(g[k-1].x+g[k-1].w));
        const maxGap=Math.max(...gaps),span=g[g.length-1].x+g[g.length-1].w-g[0].x;
        if(maxGap>Math.max(med*1.35,W*.12)||span>W*.90)continue;
        const consistency=heights.reduce((s,h)=>s+Math.abs(h-med),0)/(med*g.length);
        const score=g.length*25-consistency*25-span/W*5;
        lines.push({g,score});
      }
    }
    lines.sort((a,b)=>b.score-a.score); const out=[],seen=new Set();
    for(const l of lines){const k=l.g.map(a=>`${a.x},${a.y},${a.w},${a.h}`).join('|');if(seen.has(k))continue;seen.add(k);out.push(l);if(out.length>=8)break;}
    return out;
  }
  function glyphCanvas(bin,b){
    const {W,H,m}=bin,pad=Math.max(3,Math.round(b.h*.18)),x0=Math.max(0,b.x-pad),y0=Math.max(0,b.y-pad),x1=Math.min(W,b.x+b.w+pad),y1=Math.min(H,b.y+b.h+pad),sw=x1-x0,sh=y1-y0;
    const scale=Math.max(2,Math.min(7,Math.floor(150/Math.max(sw,sh)))),c=document.createElement('canvas');c.width=Math.max(60,sw*scale);c.height=Math.max(80,sh*scale);
    const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);const im=x.createImageData(sw,sh);
    for(let yy=0;yy<sh;yy++)for(let xx=0;xx<sw;xx++){const on=m[(y0+yy)*W+(x0+xx)],i=(yy*sw+xx)*4,v=on?0:255;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}
    const tmp=document.createElement('canvas');tmp.width=sw;tmp.height=sh;tmp.getContext('2d').putImageData(im,0,0);x.imageSmoothingEnabled=false;x.drawImage(tmp,0,0,sw,sh,0,0,c.width,c.height);return c;
  }
  async function worker(){if(!state.worker)state.worker=await Tesseract.createWorker('eng',1);return state.worker;}
  async function readGlyph(c){const w=await worker();await w.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'10'});const r=await w.recognize(c),t=(r.data.text||'').replace(/\D/g,'');return {digit:t.length===1?t:'',confidence:r.data.confidence||0};}
  function exactNumeric(id){
    if(!/^\d{4,7}$/.test(id))return null;
    const rows=state.workOrders.filter(r=>{const v=norm(r.vin),s=norm(r.stock),ro=norm(r.ro);return (v&&v.endsWith(id))||(s&&s.endsWith(id))||(ro&&ro.endsWith(id));});
    const keys=new Set(rows.map(r=>norm(r.vin)||('RO'+norm(r.ro)))); if(!rows.length||keys.size!==1)return null;
    const m=matchOCR(id); return m&&m.status==='MATCH'&&['MEDIUM','HIGH'].includes(m.confidence)?m:null;
  }
  async function segmented(source){
    const base=copy(source),reads=[];
    for(const deg of [0,180,90,270]){
      const oriented=rotate(base,deg),bin=threshold(oriented),lines=candidateLines(components(bin),bin.W,bin.H);
      for(let li=0;li<lines.length;li++){
        const digits=[];let conf=0,ok=true;
        for(const b of lines[li].g){const r=await readGlyph(glyphCanvas(bin,b));reads.push({text:r.digit,confidence:r.confidence,kind:'segmented-digit',deg,line:li+1,x:b.x,y:b.y,w:b.w,h:b.h});if(!r.digit||r.confidence<8){ok=false;break;}digits.push(r.digit);conf+=r.confidence;}
        if(!ok)continue; const id=digits.join(''),m=exactNumeric(id);
        reads.push({text:id,confidence:conf/digits.length,kind:'segmented-sequence',deg,line:li+1});
        if(m)return{text:id,match:m,reads,segmented:true};
      }
    }
    return {reads};
  }
  function render(out){if(out?.match){$('scanStatus').textContent=`Read: ${out.text}`;renderResult(out.match);}}
  async function scan(source,{render:shouldRender=true}={}){
    if(busy)return fallback(source,{render:shouldRender});busy=true;
    try{
      const seg=await segmented(source);
      if(seg.match){if(shouldRender)render(seg);return seg;}
      const fb=await fallback(source,{render:false}),out={...fb,reads:[...(seg.reads||[]),...(fb.reads||[])]};
      if(shouldRender){if(out.match)renderResult(out.match);$('scanStatus').textContent=out.text?`Read: ${String(out.text).slice(0,140)}`:'Unknown / research';}
      return out;
    } finally {busy=false;}
  }
  window.lotWalkScanSourceV6=scan;window.lotWalkScanSourceV2=scan;$('scanNow').onclick=()=>scan(video);
  const old=$('photoFile');if(old){const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>{scan(img);URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(f);});}
})();