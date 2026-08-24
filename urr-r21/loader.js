(async()=>{
  try{
    const files=[
      'urr-r20/chunk00.txt?v=21b','urr-r20/chunk01.txt?v=21b','urr-r20/chunk02.txt?v=21b',
      'urr-r20/chunk03.txt?v=21b','urr-r20/chunk04.txt?v=21b','urr-r20/chunk05.txt?v=21b',
      'urr-r21/chunk06.txt?v=21b'
    ];
    const pieces=await Promise.all(files.map(f=>fetch(f,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`Could not load ${f}`);return r.text();})));
    (0,eval)(pieces.join("\n"));
    for(const extra of ['urr-r21/domain.js?v=21b','urr-r21/learning-hooks.js?v=21b']){
      const r=await fetch(extra,{cache:"no-store"});
      if(!r.ok)throw new Error(`Could not load ${extra}`);
      (0,eval)(await r.text());
    }
  }catch(e){document.getElementById("app").innerHTML=`<div style="font-family:Arial;padding:24px;color:#b42318"><b>URR Quick Form could not start.</b><br>${String(e.message||e)}</div>`;console.error(e);}
})();
