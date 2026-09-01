// Lot Walk Scanner v5: conservatively reconstruct identifiers split across independent OCR reads.
(function(){
  const base=window.lotWalkScanSourceV4;
  const physicalKey=r=>norm(r.vin)||('RO'+norm(r.ro));
  function candidateTails(){
    const out=[];
    for(const row of state.workOrders){
      const key=physicalKey(row),vin=norm(row.vin),stock=norm(row.stock);
      for(const source of [vin,stock])for(let n=4;n<=7;n++)if(source.length>=n)out.push({text:source.slice(-n),row,key});
    }
    return out;
  }
  function readTokens(reads){
    const out=[];
    for(let i=0;i<reads.length;i++){
      const r=reads[i]||{},c=Number(r.confidence||0);if(c<18)continue;
      const compact=norm(r.text);if(compact.length>=2&&compact.length<=5&&/\d/.test(compact))out.push({text:compact,i,confidence:c,kind:r.kind||'',deg:r.deg});
      const raw=String(r.text||'').toUpperCase();
      for(const m of raw.matchAll(/[A-Z0-9][A-Z0-9 ]{1,7}[A-Z0-9]/g)){
        const t=norm(m[0]);if(t.length>=2&&t.length<=5&&/\d/.test(t))out.push({text:t,i,confidence:c,kind:r.kind||'',deg:r.deg});
      }
    }
    const seen=new Set(),dedup=[];for(const x of out){const k=x.text+'|'+x.i;if(seen.has(k))continue;seen.add(k);dedup.push(x);}
    // Whole-frame and broad-region reads are the most independent signals. Keep them before
    // the hundreds of tiny contour reads so a useful split identifier cannot be crowded out.
    const priority=k=>k==='whole'?4:(k==='center'||k==='lower-band'||k==='lower-left'||k==='lower-right'||k==='mid-left'||k==='mid-right'||k==='upper-left'||k==='upper-right'?3:(k.startsWith('cv-')?2:1));
    dedup.sort((a,b)=>priority(b.kind)-priority(a.kind)||b.confidence-a.confidence||a.i-b.i);
    return dedup.slice(0,180);
  }
  function reconstruct(reads){
    const toks=readTokens(reads),tails=candidateTails(),hits=[];
    for(let i=0;i<toks.length;i++)for(let j=i+1;j<toks.length;j++){
      const a=toks[i],b=toks[j];if(a.i===b.i)continue;
      for(const joined of [a.text+b.text,b.text+a.text]){
        if(joined.length<4||joined.length>7)continue;
        for(const c of tails){if(c.text.length!==joined.length)continue;const d=lev(joined,c.text);if(d>1)continue;
          const exactA=c.text.includes(a.text),exactB=c.text.includes(b.text);
          if(!exactA&&!exactB)continue;
          const broad=(a.kind==='whole'?8:0)+(b.kind==='whole'?8:0);
          const score=(d===0?100:72)+Math.min(18,(a.confidence+b.confidence)/10)+(exactA&&exactB?12:5)+broad;
          hits.push({score,c,a,b,joined,d});
        }
      }
    }
    hits.sort((x,y)=>y.score-x.score);if(!hits.length)return null;
    const best=hits[0],other=hits.find(h=>h.c.key!==best.c.key);
    if(other&&best.score-other.score<12)return null;
    const m=matchOCR(best.c.text);if(!m||m.status!=='MATCH')return null;
    m.confidence=m.confidence==='LOW'?'MEDIUM':m.confidence;
    m.evidence=[...(m.evidence||[]),`corroborated OCR fragments ${best.a.text} + ${best.b.text}`];
    return{text:best.c.text,match:m,reconstruction:{candidate:best.c.text,joined:best.joined,distance:best.d,score:best.score,a:best.a.text,b:best.b.text}};
  }
  function render(out){if(!out)return;const m=out.match;if(m){$('scanStatus').textContent=`Read: ${out.text.slice(0,140)}`;renderResult(m);}}
  async function scan(source,{render:shouldRender=true}={}){
    const out=await base(source,{render:false});
    if(out?.match?.status==='MATCH'&&['MEDIUM','HIGH'].includes(out.match.confidence)){if(shouldRender)render(out);return out;}
    const rebuilt=reconstruct(out?.reads||[]);
    if(rebuilt){const merged={...out,...rebuilt,reads:out?.reads||[]};if(shouldRender)render(merged);return merged;}
    if(shouldRender){if(out?.match)renderResult(out.match);$('scanStatus').textContent=out?.text?`Read: ${out.text.slice(0,140)}`:'Unknown / research';}
    return out;
  }
  window.lotWalkScanSourceV5=scan;window.lotWalkScanSourceV2=scan;$('scanNow').onclick=()=>scan(video);
  const old=$('photoFile');if(old){const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>{scan(img);URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(f);});}
})();