// Lot Walk Scanner v7: fast numeric-tail prepass, then proven v6 fallback.
(function(){
  const fallback=window.lotWalkScanSourceV6;
  let workerPromise=null,busy=false;

  function copy(source,max=1600){
    const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;
    if(!sw||!sh)throw Error('Image not ready');
    const s=Math.min(1,max/Math.max(sw,sh)),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(sw*s));c.height=Math.max(1,Math.round(sh*s));c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c;
  }
  function rotate(src,deg){
    if(!deg)return src;const q=Math.abs(deg)%180===90,c=document.createElement('canvas');c.width=q?src.height:src.width;c.height=q?src.width:src.height;
    const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);x.drawImage(src,-src.width/2,-src.height/2);return c;
  }
  async function worker(){if(!workerPromise)workerPromise=Tesseract.createWorker('eng',1);return workerPromise;}
  async function digitsRead(src){
    const w=await worker();await w.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'11'});
    const r=await w.recognize(src);return{text:(r.data.text||'').trim(),confidence:r.data.confidence||0};
  }
  function exactNumeric(id){
    if(!/^\d{4,7}$/.test(id))return null;
    const rows=state.workOrders.filter(r=>{const v=norm(r.vin),s=norm(r.stock),ro=norm(r.ro);return(v&&v.endsWith(id))||(s&&s.endsWith(id))||(ro&&ro.endsWith(id));});
    const keys=new Set(rows.map(r=>norm(r.vin)||('RO'+norm(r.ro))));if(!rows.length||keys.size!==1)return null;
    const m=matchOCR(id);return m&&m.status==='MATCH'&&['MEDIUM','HIGH'].includes(m.confidence)?m:null;
  }
  function uniqueCompletion(tail){
    if(!/^\d{3}$/.test(tail))return null;const found=new Map();
    for(const row of state.workOrders){const key=norm(row.vin)||('RO'+norm(row.ro));for(const src of [norm(row.vin),norm(row.stock)]){
      if(src.length<4)continue;for(let len=4;len<=Math.min(7,src.length);len++){const id=src.slice(-len);if(/^\d+$/.test(id)&&id.endsWith(tail)){if(!found.has(id))found.set(id,new Set());found.get(id).add(key);}}
    }}
    const candidates=[...found.entries()].filter(([,keys])=>keys.size===1).map(([id])=>id).sort((a,b)=>a.length-b.length);
    if(!candidates.length)return null;
    const shortest=candidates[0];if(candidates.some(x=>x!==shortest&&!x.endsWith(shortest)))return null;
    return shortest.length===4?shortest:null;
  }
  function tokens(text){return String(text||'').match(/\d{3,7}/g)||[];}
  function render(out){if(out?.match){$('scanStatus').textContent=`Read: ${out.text}`;renderResult(out.match);}}
  async function fast(source){
    const base=copy(source),reads=[];
    for(const deg of [0,180,90,270]){
      const r=await digitsRead(rotate(base,deg));reads.push({text:r.text,confidence:r.confidence,kind:'fast-numeric',deg});
      for(const t of tokens(r.text)){
        if(t.length>=4){const m=exactNumeric(t);if(m)return{text:t,match:m,reads,fast:true};}
        if(t.length===3&&r.confidence>=8){const id=uniqueCompletion(t),m=id&&exactNumeric(id);if(m){m.evidence=[...(m.evidence||[]),`unique VIN-tail completion ${t} → ${id}`];return{text:id,match:m,reads,fast:true,completion:{tail:t,id}};}}
      }
    }
    return{reads};
  }
  async function scan(source,{render:shouldRender=true}={}){
    if(busy)return fallback(source,{render:shouldRender});busy=true;
    try{
      const first=await fast(source);if(first.match){if(shouldRender)render(first);return first;}
      const fb=await fallback(source,{render:false}),out={...fb,reads:[...(first.reads||[]),...(fb.reads||[])]};
      if(shouldRender){if(out.match)renderResult(out.match);$('scanStatus').textContent=out.text?`Read: ${String(out.text).slice(0,140)}`:'Unknown / research';}
      return out;
    }finally{busy=false;}
  }
  window.lotWalkScanSourceV7=scan;window.lotWalkScanSourceV2=scan;$('scanNow').onclick=()=>scan(video);
  const old=$('photoFile');if(old){const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>{scan(img);URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(f);});}
})();