// Lot Walk recognition/matching hardening layered over app.js.
(function(){
  // The failed browser gate showed a 90-degree identifier could be fragmented into
  // contour candidates and the whole-frame fallback never reached the OCR loop.
  // Always put the full frame first, then adaptive candidates. This guarantees all
  // four orientation passes get one complete view before smaller regions are tried.
  const baseDetectRegions=detectRegions;
  detectRegions=function(c){
    const boxes=baseDetectRegions(c)||[];
    const full={x:0,y:0,w:c.width,h:c.height,score:Number.MAX_SAFE_INTEGER};
    const rest=boxes.filter(b=>!(b.x===0&&b.y===0&&b.w===c.width&&b.h===c.height));
    return [full,...rest];
  };

  const baseScoreRow=scoreRow;
  const confusablePairs=[['0','O'],['1','I'],['1','L'],['2','Z'],['5','S'],['6','G'],['8','B']];
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
  scoreRow=function(row,ocrText,clues){
    const out=baseScoreRow(row,ocrText,clues);
    const ro=norm(row.ro),vin=norm(row.vin),stock=norm(row.stock);
    for(const clue of clues){
      const c=norm(clue);if(c.length<4)continue;
      if(ro&&ro.endsWith(c)&&c!==ro){out.score+=64;out.e.push(`RO suffix ${clue}`);}
      if(vin&&c.length>=5){
        const tail=vin.slice(-c.length);
        if(oneConfusionAway(c,tail)){out.score+=38;out.e.push(`near VIN suffix ${clue}`);}
      }
      if(stock&&c.length>=4){
        const tail=stock.slice(-c.length);
        if(oneConfusionAway(c,tail)){out.score+=34;out.e.push(`near stock ${clue}`);}
      }
    }
    out.e=[...new Set(out.e)];
    return out;
  };
})();
