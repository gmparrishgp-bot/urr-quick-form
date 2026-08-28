const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  page.on('console',m=>console.log('BROWSER',m.type(),m.text()));
  await page.goto('http://127.0.0.1:4173/lot-walk/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.click('#loadDemo');
  await page.waitForFunction(()=>typeof window.lotWalkScanSourceV2==='function',{timeout:30000});

  async function synthetic(text,deg){
    return await page.evaluate(async({text,deg})=>{
      const c=document.createElement('canvas');c.width=900;c.height=500;
      const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);
      x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);
      x.fillStyle='black';x.textAlign='center';x.textBaseline='middle';x.font='bold 110px monospace';x.fillText(text,0,0);
      const scan=await window.lotWalkScanSourceV2(c);
      return {read:scan.text,result:document.getElementById('result').innerText,attempts:scan.reads.map(r=>({text:r.text,deg:r.deg,confidence:r.confidence,kind:r.kind}))};
    },{text,deg});
  }

  async function chalkSynthetic(text){
    return await page.evaluate(async({text})=>{
      const c=document.createElement('canvas');c.width=1152;c.height=1536;const x=c.getContext('2d');
      x.fillStyle='#82bde8';x.fillRect(0,0,c.width,c.height*.35);x.fillStyle='#ececec';x.fillRect(120,500,900,560);
      x.fillStyle='#161616';x.fillRect(130,955,890,230);x.fillStyle='#272727';x.fillRect(625,1010,300,105);
      x.strokeStyle='#dedede';x.lineWidth=7;x.lineCap='round';x.lineJoin='round';x.font='64px cursive';x.fillStyle='#dedede';x.fillText(text,690,1080);
      x.strokeStyle='#777';x.lineWidth=3;for(let i=0;i<8;i++){x.beginPath();x.moveTo(150+i*95,970);x.lineTo(180+i*95,1160);x.stroke();}
      const scan=await window.lotWalkScanSourceV2(c);
      return {read:scan.text,result:document.getElementById('result').innerText,attempts:scan.reads.map(r=>({text:r.text,deg:r.deg,confidence:r.confidence,kind:r.kind}))};
    },{text});
  }

  const straight=await synthetic('0013',0);console.log('straight',straight);assert.match(straight.result,/104849/,'straight identifier should match RO 104849');
  const rotated=await synthetic('X43053',90);console.log('rotated',rotated);assert.match(rotated.result,/105211/,'90-degree identifier should match RO 105211');
  const contextual=await synthetic('4746',180);console.log('contextual',contextual);assert.match(contextual.result,/104746/,'180-degree RO suffix should match RO 104746');
  const chalk=await chalkSynthetic('4746');console.log('chalk',chalk);assert.match(chalk.result,/104746/,'small light-on-dark chalk identifier should match RO 104746');

  await browser.close();console.log('PASS scanner OCR: straight + rotated + contextual + chalk-on-dark');
})().catch(e=>{console.error(e);process.exit(1)});
