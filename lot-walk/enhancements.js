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
    // A three-digit tail is too weak to promote by itself. It is retained only when it
    // uniquely maps to one physical VIN in the loaded WO set, so model/brand evidence can
    // corroborate a dropped first chalk character without creating a confident standalone hit.
    for(const [tail,key] of uniqueThreeDigitTails(ocrText))if(key===physicalKey(row)&&vin.endsWith(tail)){
      out.score+=28;out.e.push(`weak unique VIN tail ${tail}`);
    }
    const unique=uniqueModelTokens(row,ocrText);
    if(unique.length){
      out.score+=unique.length>=2?72:58;
      out.e.push(`unique model context ${unique.join('/')}`);
    }
    out.e=[...new Set(out.e)];
    return out;
  };
})();
