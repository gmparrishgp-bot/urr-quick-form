import puppeteer from 'puppeteer-core';
import {execSync} from 'node:child_process';

const chrome=execSync('which google-chrome || which chromium || which chromium-browser',{encoding:'utf8'}).trim().split('\n')[0];
if(!chrome) throw new Error('Chrome/Chromium not found');
const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl']});
const desktop=await browser.newPage();
desktop.setDefaultTimeout(90000);
const errors=[];
desktop.on('pageerror',e=>errors.push('desktop pageerror: '+e.message));
desktop.on('console',m=>{if(m.type()==='error')errors.push('desktop console: '+m.text())});
await desktop.goto('http://127.0.0.1:8000/staging-r21.html',{waitUntil:'domcontentloaded'});
await desktop.waitForFunction(()=>window.__urrPairUrl,{timeout:60000});
const pairUrl=await desktop.evaluate(()=>window.__urrPairUrl);
if(!pairUrl.includes('mode=phone')||!pairUrl.includes('peer='))throw new Error('Pair URL was not generated correctly: '+pairUrl);

const phone=await browser.newPage();
phone.setDefaultTimeout(90000);
phone.on('pageerror',e=>errors.push('phone pageerror: '+e.message));
phone.on('console',m=>{if(m.type()==='error')errors.push('phone console: '+m.text())});
await phone.goto(pairUrl,{waitUntil:'domcontentloaded'});
await phone.waitForFunction(()=>document.getElementById('pstatus')?.textContent.includes('Connected to computer'),{timeout:75000});
await desktop.waitForFunction(()=>document.getElementById('dstatus')?.textContent.includes('Phone connected'),{timeout:75000});

const math=await desktop.evaluate(()=>window.__urrTest.math());
const expected={a:130,b:65,c:775,d:80};
for(const [k,v] of Object.entries(expected))if(math[k]!==v)throw new Error(`Math ${k}: expected ${v}, got ${math[k]}`);

const model=await desktop.evaluate(async()=>{
  const timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error('model smoke timed out')),300000));
  return Promise.race([window.__urrTest.modelSmoke(),timeout]);
});
if(!model.trocr||model.trocr.trim().length<2)throw new Error('TrOCR returned no text');
if(!Array.isArray(model.paddleItems)||!model.paddleItems.join(' ').match(/105\s*779|105779/))throw new Error('PaddleOCR did not read synthetic RO: '+JSON.stringify(model.paddleItems));

const bad=errors.filter(x=>!x.includes('favicon'));
if(bad.length)throw new Error('Browser errors:\n'+bad.join('\n'));
console.log(JSON.stringify({pairing:'PASS',math,model},null,2));
await browser.close();
