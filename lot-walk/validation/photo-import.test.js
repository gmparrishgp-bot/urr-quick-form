const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:430,height:820}});
  await page.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.lotWalkCaptureSession,{timeout:30000});
  const picker=await page.evaluate(()=>({multiple:document.getElementById('photoFile')?.multiple,capture:document.getElementById('photoFile')?.getAttribute('capture'),label:document.getElementById('photoFile')?.parentElement?.textContent.trim()}));
  assert.equal(picker.multiple,true,'Use Photos must allow multi-select');
  assert.equal(picker.capture,null,'Use Photos must not force the camera');
  assert.match(picker.label,/Use Photos/);
  await page.click('#scanServiceArea');
  const imported=await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=40;c.height=30;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,40,30);
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg'));
    const f1=new File([b],'one.jpg',{type:'image/jpeg'}),f2=new File([b],'two.jpg',{type:'image/jpeg'});
    await window.lotWalkCaptureSession.importPhotos([f1,f2]);
    await new Promise(r=>setTimeout(r,500));
    return {rows:(await window.lotWalkCaptureSession.all()).map(r=>({name:r.name,status:r.status,area:r.area})),status:document.getElementById('scanStatus')?.textContent,summary:document.getElementById('captureSummary')?.textContent};
  });
  assert(imported.rows.length>=2,'two selected photos must be saved into the walk session');
  assert(imported.rows.some(r=>r.name==='one.jpg')&&imported.rows.some(r=>r.name==='two.jpg'),'imported file names must be retained');
  assert(imported.rows.filter(r=>r.area==='SERVICE').length>=2,'imported photos must retain selected area');
  assert.match(imported.status,/2 photos saved/,'user must get visible confirmation after import');
  assert.match(imported.summary,/photos/);

  const stuck=await browser.newPage({viewport:{width:430,height:820}});
  await stuck.goto('http://127.0.0.1:4173/lot-walk/?pair=definitely-not-a-live-host',{waitUntil:'domcontentloaded',timeout:60000});
  await stuck.waitForFunction(()=>document.getElementById('phonePairStatus'),{timeout:30000});
  await stuck.waitForTimeout(9000);
  const pair=await stuck.evaluate(()=>({state:document.getElementById('pairState')?.textContent,status:document.getElementById('phonePairStatus')?.textContent,retry:!!document.getElementById('retryPair')}));
  assert.notEqual(pair.state,'Connecting…','stale pairing must not look frozen forever');
  assert.match(pair.status,/saved on this phone|keep taking|keep.*photos/i,'stale pairing must explain offline capture behavior');
  assert.equal(pair.retry,true,'phone must expose a retry connection action');

  await stuck.close();await page.close();await browser.close();console.log('PASS multi-photo library import + visible save confirmation + nonblocking stale-pairing UX');
})().catch(e=>{console.error(e);process.exit(1)});
