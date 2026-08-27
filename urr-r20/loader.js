(async()=>{
  try{
    const files=['urr-r20/chunk00.txt?v=24', 'urr-r20/chunk01.txt?v=24', 'urr-r20/chunk02.txt?v=24', 'urr-r20/chunk03.txt?v=24', 'urr-r20/chunk04.txt?v=24', 'urr-r20/chunk05.txt?v=24', 'urr-r20/chunk06.txt?v=24'];
    const [pieces,engineText,domainText]=await Promise.all([
      Promise.all(files.map(f=>fetch(f,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`Could not load ${f}`);return r.text();}))),
      fetch('urr-r24/handwriting-engine.js?v=24',{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error('Could not load R24 handwriting engine');return r.text();}),
      fetch('urr-r21/domain.js?v=24',{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error('Could not load R21 handwriting correction layer');return r.text();})
    ]);

    // Install the trainable engine before the main app is evaluated.
    (0,eval)(engineText);

    let src=pieces.join("\n");

    // Keep PaddleOCR for printed form geometry / RO extraction, but replace the old
    // generic TrOCR model with the repo-trained URR character engine.
    src=src.replace(
      /hfModule=await import\([\s\S]*?setAIProgress\(56,"Handwriting reader ready\.","ready"\);/,
      `if(!window.URR_CHAR_ENGINE)throw new Error("URR handwriting engine did not load.");\n     await window.URR_CHAR_ENGINE.init();\n     trocr=window.URR_CHAR_ENGINE;\n     setAIProgress(56,"URR handwriting reader ready.","ready");`
    );

    // Preserve each crop's field type so inference can constrain the alphabet.
    src=src.replace(
      'return{url:c.toDataURL("image/png"),density:ink/Math.max(1,w*h)};',
      'return{url:c.toDataURL("image/png"),density:ink/Math.max(1,w*h),mode};'
    );

    // Replace TrOCR batch generation with field-specific local inference while
    // preserving the existing progress/reporting interface used by Build 33.
    src=src.replace(
      /async function trocrBatch\(crops,label,p0,p1,maxTokens=70\)\{[\s\S]*?\n \}\n\n function parseTrocrParts/,
      `async function trocrBatch(crops,label,p0,p1,maxTokens=70){\n   const out=new Array(crops.length).fill("");\n   const active=crops.map((c,i)=>({c,i})).filter(x=>x.c.density>.0007);\n   const total=Math.max(1,active.length);\n   for(let k=0;k<active.length;k++){\n     const x=active[k];\n     setAIProgress(p0+(p1-p0)*(k/total),\`${'${label}'} ${'${k+1}'} of ${'${total}'}…\`);\n     const r=await trocr.readCrop(x.c);\n     out[x.i]=cleanText(r?.text||"");\n     if((k&3)===3)await new Promise(res=>setTimeout(res,0));\n   }\n   return out;\n }\n\n function parseTrocrParts`
    );

    if(!src.includes('URR handwriting reader ready.'))throw new Error('R24 model-loader patch did not apply.');
    if(!src.includes('trocr.readCrop(x.c)'))throw new Error('R24 inference patch did not apply.');

    (0,eval)(src);
    (0,eval)(domainText);
  }catch(e){document.getElementById("app").innerHTML=`<div style="font-family:Arial;padding:24px;color:#b42318"><b>URR Quick Form could not start.</b><br>${String(e.message||e)}</div>`;console.error(e);}
})();
