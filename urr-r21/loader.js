(async()=>{
  try{
    const files=[
      'urr-r20/chunk00.txt?v=21','urr-r20/chunk01.txt?v=21','urr-r20/chunk02.txt?v=21',
      'urr-r20/chunk03.txt?v=21','urr-r20/chunk04.txt?v=21','urr-r20/chunk05.txt?v=21',
      'urr-r21/chunk06.txt?v=21'
    ];
    const pieces=await Promise.all(files.map(f=>fetch(f,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`Could not load ${f}`);return r.text();})));
    (0,eval)(pieces.join("\n"));
  }catch(e){document.getElementById("app").innerHTML=`<div style="font-family:Arial;padding:24px;color:#b42318"><b>URR Quick Form could not start.</b><br>${String(e.message||e)}</div>`;console.error(e);}
})();
