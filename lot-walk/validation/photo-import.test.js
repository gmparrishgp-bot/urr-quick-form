const { chromium, devices } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const pixel5=devices['Pixel 5'];
  const context=await browser.newContext({...pixel5});
  const page=await context.newPage();
  await page.addInitScript(()=>{try{Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});}catch{}});
  await page.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.lotWalkCaptureSession,{timeout:10000});
  const picker=await page.evaluate(()=>({multiple:document.getElementById('photoFile')?.multiple,capture:document.getElementById('photoFile')?.getAttribute('capture'),label:document.getElementById('photoFile')?.parentElement?.textContent.trim(),storage:window.lotWalkCaptureSession.storage()}));
  assert.equal(picker.multiple,true,'Use Photos must allow multi-select');
  assert.equal(picker.capture,null,'Use Photos must not force the camera');
  assert.match(picker.label,/Use Photos/);
  assert.equal(picker.storage,'memory','phone controls must work even when IndexedDB is unavailable');
  await page.click('#scanServiceArea');

  const f1=path.resolve('lot-walk/validation/real/1174_actual_crop.jpg');
  const f2=path.resolve('lot-walk/validation/real/839289_crop.jpg');
  assert(fs.existsSync(f1)&&fs.existsSync(f2));
  await page.locator('#photoFile').setInputFiles([f1,f2]);
  await page.waitForFunction(()=>document.getElementById('captureSummary')?.textContent.startsWith('2 photos'),{timeout:5000});
  const imported=await page.evaluate(async()=>({
    rows:(await window.lotWalkCaptureSession.all()).map(r=>({name:r.name,status:r.status,area:r.area})),
    status:document.getElementById('scanStatus')?.textContent,
    summary:document.getElementById('captureSummary')?.textContent,
    captureStatus:document.getElementById('captureStatus')?.textContent
  }));
  assert.equal(imported.rows.length,2,'actual file-picker change must save both photos');
  assert(imported.rows.every(r=>r.area==='SERVICE'),'imported photos must retain selected area');
  assert.match(imported.status,/2 photos saved/,'user must get immediate visible confirmation after picker closes');
  assert.match(imported.captureStatus,/2 photos saved/);

  // Pairing failure must not disable photo import.
  const stuckContext=await browser.newContext({...pixel5});
  const stuck=await stuckContext.newPage();
  await stuck.addInitScript(()=>{try{Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});}catch{}});
  await stuck.goto('http://127.0.0.1:4173/lot-walk/?pair=definitely-not-a-live-host',{waitUntil:'domcontentloaded',timeout:60000});
  await stuck.waitForFunction(()=>window.lotWalkCaptureSession&&document.getElementById('phonePairStatus'),{timeout:10000});
  await stuck.click('#scanSalesArea');
  await stuck.locator('#photoFile').setInputFiles([f1,f2]);
  await stuck.waitForFunction(()=>document.getElementById('captureSummary')?.textContent.startsWith('2 photos'),{timeout:5000});
  const offlineImport=await stuck.evaluate(async()=>({count:(await window.lotWalkCaptureSession.all()).length,status:document.getElementById('captureStatus')?.textContent}));
  assert.equal(offlineImport.count,2,'pairing failure must not block phone photo saving');
  assert.match(offlineImport.status,/2 photos saved/);
  await stuck.waitForTimeout(9000);
  const pair=await stuck.evaluate(()=>({state:document.getElementById('pairState')?.textContent,status:document.getElementById('phonePairStatus')?.textContent,retry:!!document.getElementById('retryPair')}));
  assert.notEqual(pair.state,'Connecting…','stale pairing must not look frozen forever');
  assert.equal(pair.retry,true,'phone must expose retry connection action');

  await stuckContext.close();await context.close();await browser.close();console.log('PASS Android multi-photo picker + immediate visible save + no-IndexedDB fallback + pairing-independent capture');
})().catch(e=>{console.error(e);process.exit(1)});
