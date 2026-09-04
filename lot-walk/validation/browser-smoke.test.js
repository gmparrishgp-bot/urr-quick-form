const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  page.on('console',m=>{const t=m.text();if(!t.startsWith('Estimating resolution')) console.log('BROWSER',m.type(),t)});
  await page.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.click('#loadDemo');
  await page.waitForFunction(()=>typeof window.lotWalkScanSourceV10==='function'&&window.lotWalkPairingTest&&window.lotWalkCaptureSession,{timeout:30000});
  async function synthetic(text,deg){return await page.evaluate(async({text,deg})=>{const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);x.fillStyle='black';x.textAlign='center';x.textBaseline='middle';x.font='bold 110px monospace';x.fillText(text,0,0);const scan=await window.lotWalkScanSourceV10(c);return {read:scan.text,result:document.getElementById('result').innerText};},{text,deg});}
  async function scanPath(path){return await page.evaluate(async(path)=>{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=path});const t0=performance.now(),scan=await window.lotWalkScanSourceV10(img,{render:false}),elapsed=Math.round(performance.now()-t0);return {read:scan.text,status:scan.match?.status,confidence:scan.match?.confidence,ros:(scan.match?.rows||[]).map(r=>r.ro),elapsed};},path);}

  assert.match((await synthetic('0013',0)).result,/104849/);
  assert.match((await synthetic('X43053',90)).result,/105211/);
  assert.match((await synthetic('4746',180)).result,/104746/);

  const fixtures=[['4746_actual_crop.jpg','104746',5000],['1174_actual_crop.jpg','104862',5000],['L3116_crop.jpg','105252',5000],['839289_crop.jpg','105243',5000]];
  for(const [file,ro,maxMs] of fixtures){const r=await scanPath('/lot-walk/validation/real/'+file);console.log('REAL_'+file,JSON.stringify(r));assert(r.ros.includes(ro),`${file} must resolve ${ro}`);assert(['MEDIUM','HIGH'].includes(r.confidence),`${file} must be defensible, not ${r.confidence||'unresolved'}`);assert(r.elapsed<=maxMs,`${file} must resolve within ${maxMs}ms, got ${r.elapsed}ms`);}

  // Saving a photo is a shutter action: persist first, do not wait for recognition.
  const shutter=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='bold 120px monospace';x.fillText('0013',250,270);const t0=performance.now();const rec=await window.lotWalkCaptureSession.saveCapture(c,'SERVICE',{queue:false});return {elapsed:Math.round(performance.now()-t0),id:rec.id,status:rec.status,count:(await window.lotWalkCaptureSession.all()).length};});
  assert(shutter.id&&shutter.status==='SAVED','shutter must persist a saved capture');
  assert(shutter.elapsed<1000,`shutter save should be immediate, got ${shutter.elapsed}ms`);
  assert(shutter.count>=1,'saved capture must remain in session storage');

  // Deterministic data-path checks independent of the signaling service.
  const pairing=await page.evaluate(()=>{
    const t=window.lotWalkPairingTest;t.role('computer');
    t.handle({type:'scan',area:'SERVICE',vin:'5ZT2AVTB9SB940013',rows:[{ro:'104849',vin:'5ZT2AVTB9SB940013'}],confidence:'HIGH',time:new Date().toISOString()});
    const desktopStatus=t.getStatus('5ZT2AVTB9SB940013');
    const desktopArea=t.getRecord('5ZT2AVTB9SB940013')?.area;
    t.role('phone');
    t.handle({type:'workOrders',rows:[{ro:'900001',customer:'PAIR TEST',year:'2026',make:'TEST',model:'UNIT',vin:'1TESTVIN000000001',stock:'S1',status:'OPEN'}],service:true,sales:false,activeArea:'SALES'});
    return {desktopStatus,desktopArea,phoneRows:state.workOrders.length,phoneRO:state.workOrders[0]?.ro,service:state.service,activeArea:state.activeArea,auditPresent:!!document.getElementById('auditCard'),pairPresent:!!document.getElementById('pairCard'),areaButtons:!!document.getElementById('scanServiceArea')&&!!document.getElementById('scanSalesArea'),captureCard:!!document.getElementById('captureSessionCard')};
  });
  assert.equal(pairing.desktopStatus,'ON LOT','phone scan must mark desktop audit ON LOT');
  assert.equal(pairing.desktopArea,'SERVICE','desktop audit must retain the area where the unit was found');
  assert.equal(pairing.phoneRows,1,'paired phone must receive computer WO data');
  assert.equal(pairing.phoneRO,'900001');
  assert.equal(pairing.service,true,'area completion state must sync to phone');
  assert.equal(pairing.activeArea,'SALES','active scan area must sync to phone');
  assert(pairing.auditPresent&&pairing.pairPresent&&pairing.areaButtons&&pairing.captureCard,'pairing, audit, scan-area, and capture-session UI must exist');

  // Live integration: two independent pages pair through the same PeerJS/WebRTC path used in production.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.lotWalkPairingTest&&window.lotWalkCaptureSession&&typeof window.Peer==='function',{timeout:30000});
  await page.click('#loadDemo');
  await page.click('#pairPhone');
  await page.waitForFunction(()=>document.getElementById('pairUrl')?.textContent.includes('?pair='),{timeout:15000});
  const phoneUrl=await page.locator('#pairUrl').textContent();
  const phone=await browser.newPage({viewport:{width:430,height:820}});
  phone.on('console',m=>{const t=m.text();if(!t.startsWith('Estimating resolution')) console.log('PHONE',m.type(),t)});
  await phone.goto(phoneUrl,{waitUntil:'domcontentloaded',timeout:60000});
  await phone.waitForFunction(()=>window.lotWalkCaptureSession,{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('pairState')?.textContent==='Paired',{timeout:25000});
  await phone.waitForFunction(()=>document.getElementById('pairState')?.textContent==='Paired'&&state.workOrders.length>20,{timeout:25000});
  const liveTransfer=await phone.evaluate(()=>({count:state.workOrders.length,ro:state.workOrders.find(r=>r.ro==='103515')?.ro,auditHidden:document.getElementById('auditCard')?.classList.contains('hidden')}));
  assert(liveTransfer.count>20&&liveTransfer.ro==='103515','computer WO set must transfer to phone over live connection');
  assert.equal(liveTransfer.auditHidden,true,'desktop audit must stay hidden on phone');

  await phone.click('#scanSalesArea');
  await page.waitForFunction(()=>state.activeArea==='SALES',{timeout:10000});
  assert.equal(await phone.evaluate(()=>state.activeArea),'SALES');

  // Saved-photo flow: shutter returns quickly; background recognition later marks desktop ON LOT automatically.
  await page.evaluate(()=>window.lotWalkPairingTest.setStatus('573TT3229T8839289','OFF LOT','test reset'));
  const saved=await phone.evaluate(async()=>{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src='/lot-walk/validation/real/839289_crop.jpg'});const t0=performance.now();const rec=await window.lotWalkCaptureSession.saveCapture(img,'SALES',{queue:true});return{id:rec.id,elapsed:Math.round(performance.now()-t0),status:rec.status};});
  assert(saved.id&&saved.status==='SAVED','phone must save the photo before recognition');
  assert(saved.elapsed<1000,`phone shutter must return in under 1s, got ${saved.elapsed}ms`);
  await page.waitForFunction(()=>window.lotWalkPairingTest.getStatus('573TT3229T8839289')==='ON LOT',{timeout:15000});
  const captureRecord=await page.evaluate(()=>window.lotWalkPairingTest.getRecord('573TT3229T8839289'));
  assert.equal(captureRecord.area,'SALES');
  assert.equal(captureRecord.source,'saved phone photo');
  assert.equal(captureRecord.captureId,saved.id);

  const beforeSales=await page.evaluate(()=>state.sales);
  await phone.click('#salesToggle');
  await page.waitForFunction(before=>state.sales!==before,beforeSales,{timeout:10000});
  console.log('LIVE_CAPTURE PASS',JSON.stringify({savedMs:saved.elapsed,captureId:saved.id,onLot:'573TT3229T8839289',foundArea:captureRecord.area}));

  await phone.close();await browser.close();console.log('PASS OCR gates + instant saved-photo session + background recognition + live computer audit');
})().catch(e=>{console.error(e);process.exit(1)});
