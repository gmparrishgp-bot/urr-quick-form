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
for(const r of result.results||[]) console.log(`VARIANT_${r.kind}=${r.text}`);
// This stage is exploratory: require at least meaningful handwriting signal, not exact spelling.
const all=(result.results||[]).map(r=>String(r.text||'').toLowerCase()).join(' | ');
const signal=/r[co]of|sp[ou][t]?|sea[l]?|#?60|2h/i.test(all);
if(!signal){
  console.error('PaddleOCR variants produced no useful handwriting signal.');
  process.exit(1);
}
console.log('PADDLE_SIGNAL_PASS');
