(async()=>{
  try{
    const baseFiles=['urr-r20/chunk00.txt?v=23d','urr-r20/chunk01.txt?v=23d','urr-r20/chunk02.txt?v=23d','urr-r20/chunk03.txt?v=23d','urr-r20/chunk04.txt?v=23d','urr-r20/chunk05.txt?v=23d','urr-r20/chunk06.txt?v=23d'];
    const [pieces,model,helpers,header,analyze]=await Promise.all([
      Promise.all(baseFiles.map(f=>fetch(f,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Could not load ${f}`);return r.text();}))),
      fetch('urr-r23/model_patch.txt?v=23d',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('R23 model patch missing');return r.text();}),
      fetch('urr-r22/helpers_patch.txt?v=23d',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('R22 helper patch missing');return r.text();}),
      fetch('urr-r23/header_patch.txt?v=23d',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('R23 header patch missing');return r.text();}),
      fetch('urr-r23/analyze_patch.txt?v=23d',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('R23 analyzer patch missing');return r.text();})
    ]);
    let src=pieces.join('\n');
    const replaceBetween=(a,b,repl)=>{const s=src.indexOf(a),e=src.indexOf(b,s);if(s<0||e<0)throw new Error(`Patch marker missing: ${a}`);src=src.slice(0,s)+repl+src.slice(e);};
    replaceBetween(' async function ensureHandwritingModel(){','\n function loadImg(src){',model);
    const helperMarker=' function remapCropItems(';
    const hi=src.indexOf(helperMarker);if(hi<0)throw new Error('Helper insertion marker missing');src=src.slice(0,hi)+helpers+'\n'+header+src.slice(hi);
    replaceBetween(' async function analyzePage(kind,img,paper){','\n function ensureRO(out){',analyze);
    src=src.replace('rows=geometry.rows.slice(1);','rows=geometry.rows.slice(2);');
    src=src.replace('if(handTexts[i])descTexts.push(handTexts[i]);','if(usableHandText(handTexts[i]))descTexts.push(handTexts[i]);');
    src=src.replace('const desc=bestDescription(descTexts);let totalCands=totalTexts.flatMap(totalCandidatesFromText),quote=chooseQuote(quoteTexts,totalCands),totalInfo=chooseTotal(totalTexts,quote);','let desc=bestDescription(descTexts);if(window.URR_LEARN?.correct&&desc.text){const fixed=window.URR_LEARN.correct(desc.text);if(fixed&&fixed!==desc.text)desc={text:fixed,score:Math.max(desc.score,rvPlausibility(fixed))};}let totalCands=[...totalTexts,...descTexts].flatMap(totalCandidatesFromText),quote=chooseQuote([...quoteTexts,...descTexts],totalCands),totalInfo=chooseTotal([...totalTexts,...descTexts],quote);');
    const roInsert='   const descStart=cols.make.x0+.018,partX0=cols.ro.x1-.145,totalX0=cols.date.x0,totalX1=cols.date.x1,fixX0=cols.tech.x0,fixX1=(cols.tech.x0+cols.tech.x1)/2,asisX0=fixX1,asisX1=cols.tech.x1;';
    if(!src.includes(roInsert))throw new Error('R23 RO insertion marker missing');
    src=src.replace(roInsert,'   const roScan=await readROHybrid(canvas,cols);if(roScan)ro=roScan;\n'+roInsert);
    src=src.replace('• R20 • GRID-FIRST + DYNAMIC BELOW-TABLE • LIVE SYNC','• R23 • HYBRID HANDWRITING + FORM READER • LIVE SYNC').replace(/&v=urr-r20&cb=\$\{Date\.now\(\)\}/g,'&v=urr-r23&cb=${Date.now()}');
    const testMarker=' render();\n}\nif(phoneMode)phoneApp();else desktopApp();';
    if(!src.includes(testMarker))throw new Error('R23 test insertion marker missing');
    src=src.replace(testMarker,' window.__urrTest={analyzeData:async(data,kind="quote")=>{const img=await loadImg(data);return analyzePage(kind,img,detectPaperRect(img));},math:()=>({a:calc(.5,30),b:calc(.2,25),c:calc(3.39,100),d:calc("",80)})};\n render();\n}\nif(phoneMode)phoneApp();else desktopApp();');
    (0,eval)(src);
    for(const extra of ['urr-r21/domain.js?v=23d','urr-r21/learning-hooks.js?v=23d']){
      const r=await fetch(extra,{cache:'no-store'});if(!r.ok)throw new Error(`Could not load ${extra}`);(0,eval)(await r.text());
    }
  }catch(e){document.getElementById('app').innerHTML=`<div style="font-family:Arial;padding:24px;color:#b42318"><b>URR Quick Form could not start.</b><br>${String(e.message||e)}</div>`;console.error(e);}
})();
