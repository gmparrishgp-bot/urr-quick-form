// Lot Walk recognition/matching hardening layered over app.js.
(function(){
  // Always give OCR one complete view of the frame before smaller adaptive candidates.
  const baseDetectRegions=detectRegions;
  detectRegions=function(c){
    const boxes=baseDetectRegions(c)||[];
    const full={x:0,y:0,w:c.width,h:c.height,score:Number.MAX_SAFE_INTEGER};
    const rest=boxes.filter(b=>!(b.x===0&&b.y===0&&b.w===c.width&&b.h===c.height));
    return [full,...rest];
  };

  // Default automatic page segmentation was breaking a corrected 90-degree
  // identifier into isolated glyphs. Candidate crops are label/tag regions, so
  // a uniform-block segmentation mode is a better fit and remains multi-line capable.
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
