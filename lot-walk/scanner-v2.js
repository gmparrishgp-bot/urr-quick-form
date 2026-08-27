// Lot Walk Scanner v2: explicit orientation-first OCR, then localized candidates.
// Loaded after app.js so it can reuse the recovered WO/matching/UI state while
// replacing the recognition path that failed the browser orientation gate.
(function(){
  function copySource(source,max=1600){
    const sw=source.videoWidth||source.naturalWidth||source.width;
    const sh=source.videoHeight||source.naturalHeight||source.height;
    if(!sw||!sh) throw new Error('Image not ready');
    const scale=Math.min(1,max/Math.max(sw,sh));
    const c=document.createElement('canvas');
    c.width=Math.round(sw*scale); c.height=Math.round(sh*scale);
    c.getContext('2d').drawImage(source,0,0,c.width,c.height);
    return c;
  }

  function rotateWhole(src,deg){
    const quarter=Math.abs(deg)%180===90;
    const out=document.createElement('canvas');
    out.width=quarter?src.height:src.width;
    out.height=quarter?src.width:src.height;
    const x=out.getContext('2d');
    x.fillStyle='white';x.fillRect(0,0,out.width,out.height);
    x.translate(out.width/2,out.height/2);
    x.rotate(deg*Math.PI/180);
    x.drawImage(src,-src.width/2,-src.height/2);
    return out;
  }

  function cropAndScale(src,b,scale=2.25){
    const pad=Math.round(Math.max(10,Math.min(b.w,b.h)*.18));
    const sx=Math.max(0,b.x-pad),sy=Math.max(0,b.y-pad);
    const sw=Math.min(src.width-sx,b.w+pad*2),sh=Math.min(src.height-sy,b.h+pad*2);
    const out=document.createElement('canvas');
    out.width=Math.max(1,Math.round(sw*scale));
    out.height=Math.max(1,Math.round(sh*scale));
    const x=out.getContext('2d');
    x.filter='grayscale(1) contrast(1.6)';
    x.drawImage(src,sx,sy,sw,sh,0,0,out.width,out.height);
    return out;
  }

  async function worker(){
    if(!state.worker){
      $('scanStatus').textContent='Loading local text reader…';
      state.worker=await Tesseract.createWorker('eng',1,{logger:m=>{
        if(m.status==='recognizing text') $('scanStatus').textContent=`Reading identifiers… ${Math.round((m.progress||0)*100)}%`;
      }});
    }
    return state.worker;
  }

  async function recognize(c,psm='7'){
    const w=await worker();
    await w.setParameters({
      tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- /',
      tessedit_pageseg_mode:psm,
      preserve_interword_spaces:'1'
    });
    const r=await w.recognize(c);
    return {text:(r.data.text||'').trim(),confidence:r.data.confidence||0};
  }

  function useful(text){ return extractClues(text).length>0; }
  function goodMatch(text){
    const m=matchOCR(text);
    return m.status==='MATCH' && (m.confidence==='HIGH'||m.confidence==='MEDIUM');
  }

  async function scanSource(source,{render=true}={}){
    if(state.scanning) return {text:'',match:{status:'BUSY'}};
    state.scanning=true;
    try{
      const base=copySource(source);
      const reads=[];
      // Explicitly normalize the complete image in all four orientations. This is
      // independent of contour detection, so a vertical/sideways VIN cannot be lost
      // merely because region proposal fragmented its characters.
      for(const deg of [0,90,180,270]){
        const oriented=rotateWhole(base,deg);
        const r=await recognize(oriented,'7');
        if(r.text) reads.push({...r,deg,kind:'whole'});
        if(r.text && useful(r.text) && goodMatch(r.text)){
          const m=matchOCR(r.text);
          if(render){$('scanStatus').textContent=`Read: ${r.text.slice(0,140)}`;renderResult(m);}
          return {text:r.text,match:m,reads};
        }
      }

      // If the whole frame is busy, look for text-like areas on each normalized
      // orientation and zoom those candidates before recognition.
      for(const deg of [0,90,180,270]){
        const oriented=rotateWhole(base,deg);
        let regions=[];
        try{ regions=(typeof detectRegions==='function'?detectRegions(oriented):[])||[]; }catch(_e){}
        regions=regions.filter(b=>b.w<oriented.width*.96||b.h<oriented.height*.96).slice(0,8);
        for(const b of regions){
          const crop=cropAndScale(oriented,b);
          const r=await recognize(crop,'7');
          if(r.text) reads.push({...r,deg,kind:'candidate'});
          if(r.text && useful(r.text) && goodMatch(r.text)){
            const m=matchOCR(r.text);
            if(render){$('scanStatus').textContent=`Read: ${r.text.slice(0,140)}`;renderResult(m);}
            return {text:r.text,match:m,reads};
          }
        }
      }

      const combined=reads.sort((a,b)=>b.confidence-a.confidence).map(r=>r.text).filter(Boolean).join(' ');
      const m=matchOCR(combined);
      if(render){
        $('scanStatus').textContent=combined?`Read: ${combined.slice(0,140)}`:'No usable identifier read. Try one closer frame.';
        renderResult(m);
      }
      return {text:combined,match:m,reads};
    }catch(e){
      console.error(e);
      if(render) $('scanStatus').textContent='Scan failed: '+e.message;
      return {text:'',match:{status:'ERROR',error:e.message},reads:[]};
    }finally{ state.scanning=false; }
  }

  // Expose only for automated validation; normal users use the existing controls.
  window.lotWalkScanSourceV2=scanSource;

  // Replace the scan button's failed legacy path.
  $('scanNow').onclick=()=>scanSource(video);

  // Replace photo input to remove the legacy addEventListener handler entirely.
  const oldPhoto=$('photoFile');
  if(oldPhoto){
    const fresh=oldPhoto.cloneNode(true);oldPhoto.replaceWith(fresh);
    fresh.addEventListener('change',e=>{
      const f=e.target.files[0];if(!f)return;
      const img=new Image();
      img.onload=()=>{scanSource(img);URL.revokeObjectURL(img.src)};
      img.src=URL.createObjectURL(f);
    });
  }
})();
