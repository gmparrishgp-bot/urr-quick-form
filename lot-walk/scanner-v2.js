// Lot Walk Scanner v3: real-photo hardened OCR for VIN labels, service tags, and handwritten lot identifiers.
(function(){
  function copySource(source,max=2200){
    const sw=source.videoWidth||source.naturalWidth||source.width;
    const sh=source.videoHeight||source.naturalHeight||source.height;
    if(!sw||!sh) throw new Error('Image not ready');
    const scale=Math.min(1,max/Math.max(sw,sh));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
    c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c;
  }
  function rotateWhole(src,deg){
    const q=Math.abs(deg)%180===90,out=document.createElement('canvas');
    out.width=q?src.height:src.width;out.height=q?src.width:src.height;
    const x=out.getContext('2d');x.fillStyle='white';x.fillRect(0,0,out.width,out.height);
    x.translate(out.width/2,out.height/2);x.rotate(deg*Math.PI/180);x.drawImage(src,-src.width/2,-src.height/2);return out;
  }
  function crop(src,b,scale=2.8,contrast=1.75){
    const pad=Math.round(Math.max(8,Math.min(b.w,b.h)*.10));
    const sx=Math.max(0,Math.round(b.x-pad)),sy=Math.max(0,Math.round(b.y-pad));
    const sw=Math.max(1,Math.min(src.width-sx,Math.round(b.w+pad*2))),sh=Math.max(1,Math.min(src.height-sy,Math.round(b.h+pad*2)));
    const out=document.createElement('canvas');out.width=Math.max(1,Math.round(sw*scale));out.height=Math.max(1,Math.round(sh*scale));
    const x=out.getContext('2d');x.filter=`grayscale(1) contrast(${contrast})`;x.drawImage(src,sx,sy,sw,sh,0,0,out.width,out.height);return out;
  }
  function zones(src){
    const w=src.width,h=src.height,z=[];
    const add=(name,x,y,ww,hh,priority=0)=>z.push({name,x:Math.round(x*w),y:Math.round(y*h),w:Math.round(ww*w),h:Math.round(hh*h),priority});
    add('lower-right',.42,.45,.56,.48,100);add('lower-left',.02,.45,.56,.48,96);add('lower-band',.04,.53,.92,.38,92);
    add('mid-right',.48,.25,.50,.46,80);add('mid-left',.02,.25,.50,.46,78);add('upper-right',.45,.04,.53,.48,68);add('upper-left',.02,.04,.53,.48,66);
    add('center',.18,.18,.64,.64,55);return z;
  }
  function magentaTagZones(src){
    const x=src.getContext('2d'),d=x.getImageData(0,0,src.width,src.height),w=src.width,h=src.height;
    const step=Math.max(2,Math.round(Math.max(w,h)/900)),pts=[];
    for(let yy=0;yy<h;yy+=step)for(let xx=0;xx<w;xx+=step){const i=(yy*w+xx)*4,r=d.data[i],g=d.data[i+1],b=d.data[i+2];if(r>125&&r>g*1.25&&b>70&&r-b<135)pts.push([xx,yy]);}
    if(pts.length<8)return[];
    const bins=new Map(),cell=Math.max(40,Math.round(Math.max(w,h)/14));
    for(const [xx,yy] of pts){const k=`${Math.floor(xx/cell)}:${Math.floor(yy/cell)}`;if(!bins.has(k))bins.set(k,[]);bins.get(k).push([xx,yy]);}
    const out=[];for(const group of [...bins.values()].filter(g=>g.length>=5).sort((a,b)=>b.length-a.length).slice(0,4)){
      let minX=w,minY=h,maxX=0,maxY=0;for(const [xx,yy] of group){minX=Math.min(minX,xx);minY=Math.min(minY,yy);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,yy);}
      const bw=Math.max(20,maxX-minX),bh=Math.max(12,maxY-minY);out.push({name:'service-tag-color',x:Math.max(0,minX-bw*.8-35),y:Math.max(0,minY-bh*1.1-35),w:Math.min(w-minX+bw*.8+35,bw*2.6+70),h:Math.min(h-minY+bh*1.1+35,bh*3.2+70),priority:135});
    }return out;
  }
  async function worker(){
    if(!state.worker){$('scanStatus').textContent='Loading local text reader…';state.worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text')$('scanStatus').textContent=`Reading identifiers… ${Math.round((m.progress||0)*100)}%`;}});}return state.worker;
  }
  async function recognize(c,psm='7'){
    const w=await worker();await w.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- /',tessedit_pageseg_mode:String(psm),preserve_interword_spaces:'1'});
    const r=await w.recognize(c);return{text:(r.data.text||'').trim(),confidence:r.data.confidence||0};
  }
  function useful(t){return extractClues(t).length>0;}
  function matchable(t){const m=matchOCR(t);return m.status==='MATCH'&&(m.confidence==='HIGH'||m.confidence==='MEDIUM');}
  function combinedMatch(reads){return matchOCR(reads.slice().sort((a,b)=>b.confidence-a.confidence).map(r=>r.text).filter(Boolean).join(' '));}
  async function tryRead(canvas,meta,reads,psms=['7']){
    for(const psm of psms){const r=await recognize(canvas,psm);if(r.text)reads.push({...r,...meta,psm:String(psm)});if(r.text&&useful(r.text)&&matchable(r.text))return{text:r.text,match:matchOCR(r.text)};}return null;
  }
  async function scanSource(source,{render=true}={}){
    if(state.scanning)return{text:'',match:{status:'BUSY'},reads:[]};state.scanning=true;
    try{
      const base=copySource(source),reads=[];
      for(const deg of [0,90,180,270]){const oriented=rotateWhole(base,deg);const hit=await tryRead(oriented,{deg,kind:'whole'},reads,['7','11']);if(hit){if(render){$('scanStatus').textContent=`Read: ${hit.text.slice(0,140)}`;renderResult(hit.match);}return{...hit,reads};}}
      for(const deg of [0,90,180,270]){
        const oriented=rotateWhole(base,deg);let proposals=[...magentaTagZones(oriented),...zones(oriented)];
        try{const cv=(typeof detectRegions==='function'?detectRegions(oriented):[])||[];proposals.push(...cv.filter(b=>(b.w<oriented.width*.94||b.h<oriented.height*.94)).slice(0,12).map((b,i)=>({...b,name:'cv-'+i,priority:60-(i||0)})));}catch(_e){}
        proposals.sort((a,b)=>(b.priority||0)-(a.priority||0));const seen=new Set();
        for(const b of proposals.slice(0,22)){const key=[Math.round(b.x/20),Math.round(b.y/20),Math.round(b.w/20),Math.round(b.h/20)].join(':');if(seen.has(key))continue;seen.add(key);
          for(const spec of [{s:3.0,c:1.7},{s:4.0,c:2.05}]){const c=crop(oriented,b,spec.s,spec.c),hit=await tryRead(c,{deg,kind:b.name||'zone'},reads,['7','11','13']);if(hit){if(render){$('scanStatus').textContent=`Read: ${hit.text.slice(0,140)}`;renderResult(hit.match);}return{...hit,reads};}}
        }
      }
      const text=reads.slice().sort((a,b)=>b.confidence-a.confidence).map(r=>r.text).filter(Boolean).join(' '),match=combinedMatch(reads);if(render){$('scanStatus').textContent=text?`Read candidates: ${text.slice(0,140)}`:'No defensible identifier read.';renderResult(match);}return{text,match,reads};
    }catch(e){console.error(e);if(render)$('scanStatus').textContent='Scan failed: '+e.message;return{text:'',match:{status:'ERROR',error:e.message},reads:[]};}finally{state.scanning=false;}
  }
  window.lotWalkScanSourceV2=scanSource;window.lotWalkScanSourceV3=scanSource;$('scanNow').onclick=()=>scanSource(video);
  const oldPhoto=$('photoFile');if(oldPhoto){const fresh=oldPhoto.cloneNode(true);oldPhoto.replaceWith(fresh);fresh.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>{scanSource(img);URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(f);});}

  // Replace the legacy historical-photo handler so regression photos are measured with
  // this scanner, not the superseded readImage() path. Numeric names are the actual
  // attachments supplied on 2026-08-28; original camera names remain supported in app.js.
  const currentPhotoMap={
    '494.jpg':'103395','490.jpg':'D02468','485.jpg':'A21776','438.jpg':'437881','439.jpg':'8359','440.jpg':'L3085','441.jpg':'X43053','442.jpg':'3745','443.jpg':'2787','435.jpg':'0115','436.jpg':'5612','434.jpg':'B3061','433.jpg':'3086','432.jpg':'838287','431.jpg':'839289','430.jpg':'L3116','429.jpg':'654376'
  };
  const oldFixtures=$('fixtureFiles');if(oldFixtures){const fresh=oldFixtures.cloneNode(true);oldFixtures.replaceWith(fresh);fresh.addEventListener('change',async e=>{
    const files=[...e.target.files];if(!files.length)return;if(!state.workOrders.length)setRows(DEMO_ROWS,'built-in regression data');let pass=0,checked=0;const rows=[];
    for(const f of files){const clue=currentPhotoMap[f.name];if(!clue){rows.push(`<div class="testrow">SKIP · ${escapeHtml(f.name)} · no current-photo mapping</div>`);continue;}checked++;
      const img=new Image(),url=URL.createObjectURL(f);await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});const scan=await scanSource(img,{render:false});URL.revokeObjectURL(url);
      const expected=expectedFor(clue),got=scan.match&&scan.match.status==='MATCH'?(scan.match.rows||[]).map(r=>r.ro):[];let ok=false;
      if(expected&&expected[3]==='UNRESOLVED')ok=scan.match.status==='UNRESOLVED'||scan.match.confidence!=='HIGH';else if(expected)ok=expected[2].every(ro=>got.includes(ro));
      if(ok)pass++;rows.push(`<div class="testrow ${ok?'pass':'fail'}">${ok?'PASS':'FAIL'} · ${escapeHtml(f.name)} · expected ${escapeHtml(clue)} · read ${escapeHtml(scan.text||'none')} · RO ${escapeHtml(got.join('/')||'none')}</div>`);
    }
    $('testSummary').innerHTML=`<b>${pass}/${checked} mapped current photos passed scanner-v3 regression.</b>`;$('testResults').innerHTML=rows.join('');
  });}
})();
