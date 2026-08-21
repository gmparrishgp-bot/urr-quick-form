import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
page.on('console',m=>console.log('BROWSER:',m.type(),m.text()));
page.on('pageerror',e=>console.log('PAGEERROR:',e.stack||e.message));
page.on('requestfailed',r=>console.log('REQUESTFAILED:',r.url(),r.failure()?.errorText));
await page.goto('http://127.0.0.1:8000/tests/paddle-test.html',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>window.__ocr?.done===true,null,{timeout:180000});
const result=await page.evaluate(()=>window.__ocr);
console.log('PADDLE_RESULT='+JSON.stringify(result));
await browser.close();
if(result.error) process.exit(2);
const norm=String(result.text||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const required=['roof','spot','seal'];
const matched=required.filter(w=>norm.includes(w));
console.log('MATCHED='+matched.join(','));
if(!norm.includes('roof')||matched.length<2){
  console.error('PaddleOCR regression failed: expected recognizable ROOF SPOT SEAL handwriting.');
  process.exit(1);
}
console.log('PADDLE_OCR_REGRESSION_PASS');
