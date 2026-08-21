(async()=>{
  try{
    const baseFiles=['urr-r20/chunk00.txt?v=22','urr-r20/chunk01.txt?v=22','urr-r20/chunk02.txt?v=22','urr-r20/chunk03.txt?v=22','urr-r20/chunk04.txt?v=22','urr-r20/chunk05.txt?v=22','urr-r20/chunk06.txt?v=22'];
    const [pieces,model,helpers,analyze]=await Promise.all([
      Promise.all(baseFiles.map(f=>fetch(f,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Could not load ${f}`);return r.text();}))),
      fetch('urr-r22/model_patch.txt?v=22',{cache:'no-store'}).then(r=>r.text()),
      fetch('urr-r22/helpers_patch.txt?v=22',{cache:'no-store'}).then(r=>r.text()),
      fetch('urr-r22/analyze_patch.txt?v=22',{cache:'no-store'}).then(r=>r.text())
    ]);
    let src=pieces.join('\n');
    const replaceBetween=(a,b,repl)=>{const s=src.indexOf(a),e=src.indexOf(b,s);if(s<0||e<0)throw new Error(`Patch marker missing: ${a}`);src=src.slice(0,s)+repl+src.slice(e);};
    replaceBetween(' async function ensureHandwritingModel(){','\n function loadImg(src){',model);
    const helperMarker=' function remapCropItems(';
    const hi=src.indexOf(helperMarker);if(hi<0)throw new Error('Helper insertion marker missing');src=src.slice(0,hi)+helpers+src.slice(hi);
    replaceBetween(' async function analyzePage(kind,img,paper){','\n function ensureRO(out){',analyze);
    src=src.replace('• R20 • GRID-FIRST + DYNAMIC BELOW-TABLE • LIVE SYNC','• R22 • PADDLE ENSEMBLE FORM READER • LIVE SYNC').replace(/&v=urr-r20&cb=\$\{Date\.now\(\)\}/g,'&v=urr-r22&cb=${Date.now()}');
    (0,eval)(src);
  }catch(e){document.getElementById('app').innerHTML=`<div style="font-family:Arial;padding:24px;color:#b42318"><b>URR Quick Form could not start.</b><br>${String(e.message||e)}</div>`;console.error(e);}
})();
