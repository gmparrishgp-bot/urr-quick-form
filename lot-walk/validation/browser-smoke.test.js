const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  page.on('console',m=>console.log('BROWSER',m.type(),m.text()));
  await page.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.click('#loadDemo');

  async function synthetic(text,deg){
    return await page.evaluate(async({text,deg})=>{
      const c=document.createElement('canvas');c.width=900;c.height=500;
      const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);
      x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);
      x.fillStyle='black';x.textAlign='center';x.textBaseline='middle';x.font='bold 110px monospace';x.fillText(text,0,0);
      const read=await readImage(c);
      return {read,result:document.getElementById('result').innerText};
    },{text,deg});
  }

  const straight=await synthetic('0013',0);
  console.log('straight',straight);
  assert.match(straight.result,/104849/,'straight identifier should match RO 104849');

  const rotated=await synthetic('X43053',90);
  console.log('rotated',rotated);
  assert.match(rotated.result,/105211/,'90-degree identifier should match RO 105211');

  const contextual=await synthetic('4746',180);
  console.log('contextual',contextual);
  assert.match(contextual.result,/104746/,'180-degree RO suffix should match RO 104746');

  await browser.close();
  console.log('PASS browser OCR smoke: straight + 90-degree + 180-degree/contextual');
})().catch(e=>{console.error(e);process.exit(1)});
