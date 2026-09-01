const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  page.on('console',m=>{const t=m.text();if(!t.startsWith('Estimating resolution')) console.log('BROWSER',m.type(),t)});
  await page.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.click('#loadDemo');
  await page.waitForFunction(()=>typeof window.lotWalkScanSourceV10==='function',{timeout:30000});
  async function synthetic(text,deg){return await page.evaluate(async({text,deg})=>{const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);x.fillStyle='black';x.textAlign='center';x.textBaseline='middle';x.font='bold 110px monospace';x.fillText(text,0,0);const scan=await window.lotWalkScanSourceV10(c);return {read:scan.text,result:document.getElementById('result').innerText};},{text,deg});}
  async function scanPath(path){return await page.evaluate(async(path)=>{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=path});const t0=performance.now(),scan=await window.lotWalkScanSourceV10(img,{render:false}),elapsed=Math.round(performance.now()-t0);const useful=(scan.reads||[]).filter(r=>/\d/.test(r.text||'')&&Number(r.confidence||0)>=6).sort((a,b)=>Number(b.confidence||0)-Number(a.confidence||0)).slice(0,60).map(r=>({text:r.text,confidence:Math.round(r.confidence||0),kind:r.kind,deg:r.deg,line:r.line,psm:r.psm}));return {read:scan.text,status:scan.match?.status,confidence:scan.match?.confidence,score:scan.match?.score,evidence:scan.match?.evidence,ros:(scan.match?.rows||[]).map(r=>r.ro),elapsed,attemptCount:(scan.reads||[]).length,fast:scan.fast,mode:scan.mode,completion:scan.completion,segmented:scan.segmented,reconstruction:scan.reconstruction,useful};},path);}

  assert.match((await synthetic('0013',0)).result,/104849/);
  assert.match((await synthetic('X43053',90)).result,/105211/);
  assert.match((await synthetic('4746',180)).result,/104746/);

  const fixtures=[['4746_actual_crop.jpg','104746',5000],['1174_actual_crop.jpg','104862',5000],['L3116_crop.jpg','105252',5000],['839289_crop.jpg','105243',5000]];
  for(const [file,ro,maxMs] of fixtures){const r=await scanPath('/lot-walk/validation/real/'+file);console.log('REAL_'+file,JSON.stringify(r));assert(r.ros.includes(ro),`${file} must resolve ${ro}`);assert(['MEDIUM','HIGH'].includes(r.confidence),`${file} must be defensible, not ${r.confidence||'unresolved'}`);assert(r.elapsed<=maxMs,`${file} must resolve within ${maxMs}ms, got ${r.elapsed}ms`);}

  await browser.close();console.log('PASS v10 synthetic orientation gates + four required real July photo gates under 5s each');
})().catch(e=>{console.error(e);process.exit(1)});
