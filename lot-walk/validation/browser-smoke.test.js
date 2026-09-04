const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  page.on('console',m=>{const t=m.text();if(!t.startsWith('Estimating resolution')) console.log('BROWSER',m.type(),t)});
  await page.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.click('#loadDemo');
  await page.waitForFunction(()=>typeof window.lotWalkScanSourceV10==='function'&&window.lotWalkPairingTest,{timeout:30000});
  async function synthetic(text,deg){return await page.evaluate(async({text,deg})=>{const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);x.fillStyle='black';x.textAlign='center';x.textBaseline='middle';x.font='bold 110px monospace';x.fillText(text,0,0);const scan=await window.lotWalkScanSourceV10(c);return {read:scan.text,result:document.getElementById('result').innerText};},{text,deg});}
  async function scanPath(path){return await page.evaluate(async(path)=>{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=path});const t0=performance.now(),scan=await window.lotWalkScanSourceV10(img,{render:false}),elapsed=Math.round(performance.now()-t0);return {read:scan.text,status:scan.match?.status,confidence:scan.match?.confidence,ros:(scan.match?.rows||[]).map(r=>r.ro),elapsed};},path);}

  assert.match((await synthetic('0013',0)).result,/104849/);
  assert.match((await synthetic('X43053',90)).result,/105211/);
  assert.match((await synthetic('4746',180)).result,/104746/);

  const fixtures=[['4746_actual_crop.jpg','104746',5000],['1174_actual_crop.jpg','104862',5000],['L3116_crop.jpg','105252',5000],['839289_crop.jpg','105243',5000]];
  for(const [file,ro,maxMs] of fixtures){const r=await scanPath('/lot-walk/validation/real/'+file);console.log('REAL_'+file,JSON.stringify(r));assert(r.ros.includes(ro),`${file} must resolve ${ro}`);assert(['MEDIUM','HIGH'].includes(r.confidence),`${file} must be defensible, not ${r.confidence||'unresolved'}`);assert(r.elapsed<=maxMs,`${file} must resolve within ${maxMs}ms, got ${r.elapsed}ms`);}

  // Deterministic data-path checks independent of the signaling service.
  const pairing=await page.evaluate(()=>{
    const t=window.lotWalkPairingTest;t.role('computer');
    t.handle({type:'scan',vin:'5ZT2AVTB9SB940013',rows:[{ro:'104849',vin:'5ZT2AVTB9SB940013'}],confidence:'HIGH',time:new Date().toISOString()});
    const desktopStatus=t.getStatus('5ZT2AVTB9SB940013');
    t.role('phone');
    t.handle({type:'workOrders',rows:[{ro:'900001',customer:'PAIR TEST',year:'2026',make:'TEST',model:'UNIT',vin:'1TESTVIN000000001',stock:'S1',status:'OPEN'}],service:true,sales:false});
    return {desktopStatus,phoneRows:state.workOrders.length,phoneRO:state.workOrders[0]?.ro,service:state.service,auditPresent:!!document.getElementById('auditCard'),pairPresent:!!document.getElementById('pairCard')};
  });
  assert.equal(pairing.desktopStatus,'ON LOT','phone scan must mark desktop audit ON LOT');
  assert.equal(pairing.phoneRows,1,'paired phone must receive computer WO data');
  assert.equal(pairing.phoneRO,'900001');
  assert.equal(pairing.service,true,'area state must sync to phone');
  assert(pairing.auditPresent&&pairing.pairPresent,'pairing and audit UI must exist');

  // Live integration: two independent pages pair through the same PeerJS/WebRTC path used in production.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.lotWalkPairingTest&&typeof window.Peer==='function',{timeout:30000});
  await page.click('#loadDemo');
  await page.click('#pairPhone');
  await page.waitForFunction(()=>document.getElementById('pairUrl')?.textContent.includes('?pair='),{timeout:15000});
  const phoneUrl=await page.locator('#pairUrl').textContent();
  const phone=await browser.newPage({viewport:{width:430,height:820}});
  phone.on('console',m=>{const t=m.text();if(!t.startsWith('Estimating resolution')) console.log('PHONE',m.type(),t)});
  await phone.goto(phoneUrl,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.getElementById('pairState')?.textContent==='Paired',{timeout:25000});
  await phone.waitForFunction(()=>document.getElementById('pairState')?.textContent==='Paired'&&state.workOrders.length>20,{timeout:25000});
  const liveTransfer=await phone.evaluate(()=>({count:state.workOrders.length,ro:state.workOrders.find(r=>r.ro==='103515')?.ro,auditHidden:document.getElementById('auditCard')?.classList.contains('hidden')}));
  assert(liveTransfer.count>20&&liveTransfer.ro==='103515','computer WO set must transfer to phone over live connection');
  assert.equal(liveTransfer.auditHidden,true,'desktop audit must stay hidden on phone');

  // A phone-confirmed match must traverse WebRTC and change the desktop audit, not just local state.
  await page.evaluate(()=>window.lotWalkPairingTest.setStatus('573TE3224S6654376','OFF LOT','test reset'));
  await phone.evaluate(()=>renderResult(matchOCR('654376')));
  await phone.click('#proceed');
  await page.waitForFunction(()=>window.lotWalkPairingTest.getStatus('573TE3224S6654376')==='ON LOT',{timeout:10000});
  assert.equal(await page.evaluate(()=>window.lotWalkPairingTest.getStatus('573TE3224S6654376')),'ON LOT');

  // Area completion toggles must return from phone to computer on the same channel.
  const beforeSales=await page.evaluate(()=>state.sales);
  await phone.click('#salesToggle');
  await page.waitForFunction(before=>state.sales!==beforeSales,beforeSales,{timeout:10000});
  console.log('LIVE_PAIR PASS',JSON.stringify({phoneRows:liveTransfer.count,onLot:'573TE3224S6654376',salesSynced:true}));

  await phone.close();await browser.close();console.log('PASS v10 OCR gates + deterministic pairing + live two-browser pairing/audit workflow');
})().catch(e=>{console.error(e);process.exit(1)});
