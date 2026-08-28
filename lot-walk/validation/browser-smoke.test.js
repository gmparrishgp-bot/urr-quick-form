const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  page.on('console',m=>console.log('BROWSER',m.type(),m.text()));
  await page.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.click('#loadDemo');
  await page.waitForFunction(()=>typeof window.lotWalkScanSourceV2==='function',{timeout:30000});
  async function synthetic(text,deg){return await page.evaluate(async({text,deg})=>{const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);x.fillStyle='black';x.textAlign='center';x.textBaseline='middle';x.font='bold 110px monospace';x.fillText(text,0,0);const scan=await window.lotWalkScanSourceV2(c);return {read:scan.text,result:document.getElementById('result').innerText};},{text,deg});}
  async function scanPath(path){return await page.evaluate(async(path)=>{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=path});const scan=await window.lotWalkScanSourceV2(img,{render:false});return {read:scan.text,status:scan.match?.status,confidence:scan.match?.confidence,score:scan.match?.score,evidence:scan.match?.evidence,ros:(scan.match?.rows||[]).map(r=>r.ro),attempts:scan.reads.map(r=>({text:r.text,deg:r.deg,confidence:r.confidence,kind:r.kind}))};},path);}

  assert.match((await synthetic('0013',0)).result,/104849/);
  assert.match((await synthetic('X43053',90)).result,/105211/);
  assert.match((await synthetic('4746',180)).result,/104746/);

  const real4746=await scanPath('/lot-walk/validation/real/4746_actual_crop.jpg');console.log('REAL4746',JSON.stringify(real4746));
  assert(real4746.ros.includes('104746'));assert(['MEDIUM','HIGH'].includes(real4746.confidence));
  const real1174=await scanPath('/lot-walk/validation/real/1174_actual_crop.jpg');console.log('REAL1174',JSON.stringify(real1174));
  assert(real1174.ros.includes('104862'));assert(['MEDIUM','HIGH'].includes(real1174.confidence));

  const realL3116=await scanPath('/lot-walk/validation/real/L3116_crop.jpg');console.log('REALL3116',JSON.stringify(realL3116));
  assert(!(['MEDIUM','HIGH'].includes(realL3116.confidence)&&!realL3116.ros.includes('105252')),'L3116 crop must not false-match');
  const real839289=await scanPath('/lot-walk/validation/real/839289_crop.jpg');console.log('REAL839289',JSON.stringify(real839289));
  assert(!(['MEDIUM','HIGH'].includes(real839289.confidence)&&!real839289.ros.includes('105243')),'839289 crop must not false-match');

  await browser.close();console.log('PASS real July gates and additional real-photo diagnostics');
})().catch(e=>{console.error(e);process.exit(1)});
