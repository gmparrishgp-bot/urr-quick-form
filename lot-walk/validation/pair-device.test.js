const { chromium, devices } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const desktopContext=await browser.newContext({viewport:{width:1200,height:900}});
  const phoneContext=await browser.newContext({...devices['Pixel 5']});
  const desktop=await desktopContext.newPage();
  const phone=await phoneContext.newPage();
  desktop.on('console',m=>console.log('DESKTOP',m.type(),m.text()));
  phone.on('console',m=>console.log('PHONE',m.type(),m.text()));

  await desktop.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await desktop.waitForFunction(()=>typeof window.Peer==='function'&&window.lotWalkPairingTest,{timeout:15000});
  await desktop.click('#loadDemo');
  await desktop.click('#pairPhone');
  await desktop.waitForFunction(()=>document.getElementById('pairUrl')?.textContent.includes('?pair='),{timeout:15000});
  const url=await desktop.locator('#pairUrl').textContent();
  assert(url.includes('?pair='));

  await phone.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await phone.waitForFunction(()=>window.lotWalkCaptureSession&&document.getElementById('pairState'),{timeout:15000});
  await desktop.waitForFunction(()=>document.getElementById('pairState')?.textContent==='Paired',{timeout:30000});
  await phone.waitForFunction(()=>document.getElementById('pairState')?.textContent==='Paired'&&state.workOrders.length>20,{timeout:30000});

  const d=await desktop.evaluate(()=>({state:document.getElementById('pairState')?.textContent,count:state.workOrders.length}));
  const p=await phone.evaluate(()=>({state:document.getElementById('pairState')?.textContent,count:state.workOrders.length,ro:state.workOrders.some(r=>r.ro==='104849')}));
  assert.equal(d.state,'Paired');
  assert.equal(p.state,'Paired');
  assert(p.count>20&&p.ro,'phone must receive the desktop WO set');

  await phone.click('#scanServiceArea');
  await desktop.waitForFunction(()=>state.activeArea==='SERVICE',{timeout:10000});
  await phone.click('#serviceToggle');
  await desktop.waitForFunction(()=>state.service===true,{timeout:10000});

  await phoneContext.close();await desktopContext.close();await browser.close();
  console.log('PASS separate Chromium contexts pair and sync WOs + area state');
})().catch(e=>{console.error(e);process.exit(1)});
