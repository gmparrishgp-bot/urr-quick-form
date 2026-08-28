// Lot Walk recognition/matching hardening layered over app.js.
(function(){
  const baseDetectRegions=detectRegions;
  detectRegions=function(c){
    const boxes=baseDetectRegions(c)||[];
    const full={x:0,y:0,w:c.width,h:c.height,score:Number.MAX_SAFE_INTEGER};
    const rest=boxes.filter(b=>!(b.x===0&&b.y===0&&b.w===c.width&&b.h===c.height));
    return [full,...rest];
  };

  const baseEnsureWorker=ensureWorker;
  ensureWorker=async function(){
    const worker=await baseEnsureWorker();
    await worker.setParameters({
      tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- /',
      tessedit_pageseg_mode:'6',
      preserve_interword_spaces:'1'
    });
    return worker;
  };

  const baseScoreRow=scoreRow;
  const confusablePairs=[['0','O'],['1','I'],['1','L'],['1','7'],['2','Z'],['5','S'],['6','G'],['8','B']];
  const genericContext=new Set(['GRAND','DESIGN','FOREST','RIVER','PRIME','WAYFINDER','HIGHLAND','TRAILER','TRAVEL','SPORT','LIMITED']);
  const physicalKey=r=>norm(r.vin)||('RO'+norm(r.ro));
  function oneConfusionAway(a,b){
    a=norm(a);b=norm(b);if(a.length!==b.length||a.length<4)return false;
    let diffs=0;
    for(let i=0;i<a.length;i++){
      if(a[i]===b[i])continue;
      if(!confusablePairs.some(([x,y])=>(a[i]===x&&b[i]===y)||(a[i]===y&&b[i]===x)))return false;
      if(++diffs>1)return false;
    }
    return diffs===1;
  }
  function uniqueModelTokens(row,ocrText){
    const words=new Set(tokens(ocrText));
    const rowTokens=[...new Set([...tokens(row.make),...tokens(row.model)])]
      .filter(t=>t.length>=4&&!genericContext.has(t)&&words.has(t));
    if(!rowTokens.length)return[];
    return rowTokens.filter(t=>{
      const vins=new Set(state.workOrders.filter(r=>[...tokens(r.make),...tokens(r.model)].includes(t)).map(physicalKey));
      return vins.size===1&&vins.has(physicalKey(row));
    });
  }
  function uniqueThreeDigitTails(ocrText){
    const vals=[...new Set((String(ocrText||'').match(/\b\d{3}\b/g)||[]))],map=new Map();
    for(const c of vals){
      const vins=new Set(state.workOrders.filter(r=>norm(r.vin).endsWith(c)).map(physicalKey));
      if(vins.size===1)map.set(c,[...vins][0]);
    }
    return map;
  }
  function shortSegments(ocrText){
    const out=[];
    for(const line of String(ocrText||'').toUpperCase().split(/\n+/)){
      const n=line.replace(/[^A-Z0-9]/g,'');
      if(n.length>=3&&n.length<=8)out.push(n);
      // OCR frequently inserts spaces inside one chalk number (for example "1 17U").
      for(const m of line.matchAll(/(?:[A-Z0-9]\s*){3,6}/g)){
        const c=norm(m[0]);if(c.length>=3&&c.length<=6)out.push(c);
      }
    }
    return [...new Set(out)];
  }
  function droppedLeadingDigitCorroboration(row,ocrText,uniqueTails){
    const vin=norm(row.vin);if(vin.length<4)return null;const suffix4=vin.slice(-4),head3=suffix4.slice(0,3),tail3=suffix4.slice(1);
    if(uniqueTails.get(tail3)!==physicalKey(row))return null;
    const segs=shortSegments(ocrText);
    // The unique 3-digit tail must be seen independently, plus another compact OCR fragment
    // must preserve the first three characters of the expected four-character suffix. This
    // reconstructs a dropped/garbled edge digit but cannot promote a lone 3-digit coincidence.
    const support=segs.find(s=>s.includes(head3)||oneConfusionAway((s.length===4?s:s.slice(0,4)),suffix4));
    return support?{suffix4,tail3,support}:null;
  }
  scoreRow=function(row,ocrText,clues){
    const out=baseScoreRow(row,ocrText,clues);
    const ro=norm(row.ro),vin=norm(row.vin),stock=norm(row.stock);
    for(const clue of clues){
      const c=norm(clue);if(c.length<4)continue;
      if(ro&&ro.endsWith(c)&&c!==ro){out.score+=64;out.e.push(`RO suffix ${clue}`);}
      if(ro&&c.length>=4){const tail=ro.slice(-c.length);if(oneConfusionAway(c,tail)){out.score+=64;out.e.push(`near RO suffix ${clue}`);}}
      if(vin&&c.length>=5){
        const tail=vin.slice(-c.length);
        if(oneConfusionAway(c,tail)){out.score+=38;out.e.push(`near VIN suffix ${clue}`);}
      }
      if(stock&&c.length>=4){
        const tail=stock.slice(-c.length);
        if(oneConfusionAway(c,tail)){out.score+=34;out.e.push(`near stock ${clue}`);}
      }
    }
    const uniqueTails=uniqueThreeDigitTails(ocrText);
    for(const [tail,key] of uniqueTails)if(key===physicalKey(row)&&vin.endsWith(tail)){
      out.score+=28;out.e.push(`weak unique VIN tail ${tail}`);
    }
    const reconstructed=droppedLeadingDigitCorroboration(row,ocrText,uniqueTails);
    if(reconstructed){out.score+=36;out.e.push(`corroborated VIN suffix ${reconstructed.suffix4}`);}
    const unique=uniqueModelTokens(row,ocrText);
    if(unique.length){
      out.score+=unique.length>=2?72:58;
      out.e.push(`unique model context ${unique.join('/')}`);
    }
    out.e=[...new Set(out.e)];
    return out;
  };
})();
