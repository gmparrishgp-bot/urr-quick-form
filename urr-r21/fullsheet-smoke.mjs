import puppeteer from 'puppeteer-core';
import {execSync} from 'node:child_process';
import fs from 'node:fs';

const result={time:new Date().toISOString(),success:false,checks:{},output:null,error:null};
let browser;
try{
  const chrome=execSync('which google-chrome || which chromium || which chromium-browser',{encoding:'utf8'}).trim().split('\n')[0];
  browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl']});
  const page=await browser.newPage();page.setDefaultTimeout(360000);
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')pageErrors.push(m.text())});
  await page.goto('http://127.0.0.1:8000/staging-r21.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__urrTest?.analyzeData&&window.URR_R21_DOMAIN_TEST,{timeout:90000});
  const domain=await page.evaluate(()=>window.URR_R21_DOMAIN_TEST);
  result.checks.domain=`${domain.pass}/${domain.total}`;
  if(domain.pass!==domain.total)throw new Error('Domain correction benchmark failed: '+JSON.stringify(domain.results.filter(x=>!x.ok)));

  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=1200;c.height=1680;const x=c.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.strokeStyle='#333';x.lineWidth=2;x.fillStyle='#111';
    x.font='bold 42px Arial';x.textAlign='center';x.fillText("Bish's RV Used",600,85);x.fillText('Recommended Repairs',600,135);x.textAlign='left';
    const left=85,right=1115,headTop=220,headBottom=330;
    x.strokeRect(left,headTop,right-left,headBottom-headTop);
    const hc=[85,250,420,585,735,875,995,1115];for(const v of hc){x.beginPath();x.moveTo(v,headTop);x.lineTo(v,headBottom);x.stroke();}
    x.font='24px Arial';['Make','Model','Stock#','RO#','Date','Tech','Outfitter'].forEach((t,i)=>x.fillText(t,hc[i]+14,252));
    x.font='30px Arial';x.fillText('105779',600,305);
    const tableTop=350,rowH=70,rows=16,descEnd=735,totalEnd=875,fixEnd=935,asisEnd=995;
    x.strokeRect(left,tableTop,right-left,rowH*(rows+1));
    for(let i=0;i<=rows+1;i++){const y=tableTop+i*rowH;x.beginPath();x.moveTo(left,y);x.lineTo(right,y);x.stroke();}
    for(const v of [125,descEnd,totalEnd,fixEnd,asisEnd]){x.beginPath();x.moveTo(v,tableTop);x.lineTo(v,tableTop+rowH*(rows+1));x.stroke();}
    x.font='bold 24px Arial';x.fillText('Problem Found/Repair Needed',150,392);x.fillText('Total Cost',748,382);x.fillText('of Repair',760,410);x.fillText('Fix',890,392);x.fillText('As Is',945,392);x.fillText('SM/GM',1015,392);
    const jobs=[
      {t:'ROOF SPOT SEAL',p:'$60',h:'2 HR',total:'$460'},
      {t:'ODS EXTERIOR TRIM RESEAL',p:'$30',h:'.5 HR',total:'$130'},
      {t:'LP DETECTOR OUT OF DATE REPLACE',p:'$65',h:'.5 HR',total:'$165'},
      {t:'WBP',p:'$80',h:'2.60 HR',total:'$600'}
    ];
    x.font='34px cursive';x.fillStyle='#202020';
    jobs.forEach((j,i)=>{const y=tableTop+rowH*(i+1)+48;x.fillText(j.t,150,y);x.fillStyle='#b31919';x.fillText(j.p,555,y);x.fillText(j.h,645,y);x.fillStyle='#3420a8';x.fillText(j.total,755,y);x.fillStyle='#202020';});
    return c.toDataURL('image/png');
  });
  const out=await page.evaluate(async data=>window.__urrTest.analyzeData(data,'quote'),data);
  result.output=out;
  result.checks.ro=out.ro;
  result.checks.jobCount=out.jobs?.length||0;
  const titles=(out.jobs||[]).map(j=>String(j.title||'').toLowerCase());
  result.checks.titles=titles;
  if(out.ro!=='105779')throw new Error('RO mismatch: '+out.ro);
  if((out.jobs?.length||0)<4)throw new Error('Expected at least four jobs; got '+(out.jobs?.length||0));
  const must=['roof','exterior','detector','wbp'];for(const w of must)if(!titles.some(t=>t.includes(w)))throw new Error('Missing expected repair concept: '+w+' in '+JSON.stringify(titles));
  if(pageErrors.filter(e=>!e.includes('favicon')).length)throw new Error('Browser errors: '+pageErrors.join(' | '));
  result.success=true;
}catch(e){result.error=String(e?.stack||e);}finally{if(browser)await browser.close();fs.mkdirSync('validation',{recursive:true});fs.writeFileSync('validation/r21-fullsheet-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
if(!result.success)process.exitCode=1;
