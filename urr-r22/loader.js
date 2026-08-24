(async()=>{
  try{
    const baseFiles=['urr-r20/chunk00.txt?v=22b','urr-r20/chunk01.txt?v=22b','urr-r20/chunk02.txt?v=22b','urr-r20/chunk03.txt?v=22b','urr-r20/chunk04.txt?v=22b','urr-r20/chunk05.txt?v=22b','urr-r20/chunk06.txt?v=22b'];
    const [pieces,model,helpers,analyze]=await Promise.all([
      Promise.all(baseFiles.map(f=>fetch(f,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Could not load ${f}`);return r.text();}))),
      fetch('urr-r22/model_patch.txt?v=22b',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('R22 model patch missing');return r.text();}),
      fetch('urr-r22/helpers_patch.txt?v=22b',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('R22 helper patch missing');return r.text();}),
      fetch('urr-r22/analyze_patch.txt?v=22b',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('R22 analyzer patch missing');return r.text();})
    ]);
    let src=pieces.join('\n');
    src=src.replace('"use strict";','"use strict";\nlet trocrPipe=null,trocrLoading=null;');
    const replaceBetween=(a,b,repl)=>{const s=src.indexOf(a),e=src.indexOf(b,s);if(s<0||e<0)throw new Error(`Patch marker missing: ${a}`);src=src.slice(0,s)+repl+src.slice(e);};
    replaceBetween(' async function ensureHandwritingModel(){','\n function loadImg(src){',model);
    const helperMarker=' function remapCropItems(';
    const hi=src.indexOf(helperMarker);if(hi<0)throw new Error('Helper insertion marker missing');src=src.slice(0,hi)+helpers+src.slice(hi);
    replaceBetween(' async function analyzePage(kind,img,paper){','\n function ensureRO(out){',analyze);
    src=src.replace('• R20 • GRID-FIRST + DYNAMIC BELOW-TABLE • LIVE SYNC','• R22 • HANDWRITING LINE READER + FORM GEOMETRY • LIVE SYNC').replace(/&v=urr-r20&cb=\$\{Date\.now\(\)\}/g,'&v=urr-r22&cb=${Date.now()}');
    const testMarker=' render();\n}\nif(phoneMode)phoneApp();else desktopApp();';
    if(!src.includes(testMarker))throw new Error('R22 test insertion marker missing');
    src=src.replace(testMarker,' window.__urrTest={analyzeData:async(data,kind="quote")=>{const img=await loadImg(data);return analyzePage(kind,img,detectPaperRect(img));},math:()=>({a:calc(.5,30),b:calc(.2,25),c:calc(3.39,100),d:calc("",80)})};\n render();\n}\nif(phoneMode)phoneApp();else desktopApp();');
    (0,eval)(src);
    for(const extra of ['urr-r21/domain.js?v=22b','urr-r21/learning-hooks.js?v=22b']){
      const r=await fetch(extra,{cache:'no-store'});if(!r.ok)throw new Error(`Could not load ${extra}`);(0,eval)(await r.text());
    }
  }catch(e){document.getElementById('app').innerHTML=`<div style="font-family:Arial;padding:24px;color:#b42318"><b>URR Quick Form could not start.</b><br>${String(e.message||e)}</div>`;console.error(e);}
})();
