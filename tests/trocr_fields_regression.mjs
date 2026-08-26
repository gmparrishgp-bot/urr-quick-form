import fs from 'node:fs/promises';
import vm from 'node:vm';
import { pipeline, RawImage } from '@huggingface/transformers';

const src=await fs.readFile('tests/trocr_regression.mjs','utf8');
const m=src.match(/const CASES = (\[[\s\S]*?\]);\nfunction norm/);if(!m)throw new Error('cases');
const rows=vm.runInNewContext(m[1]);
const specs={
  '01':{desc:'ROOF SPOT SEAL',descEnd:.68,parts:'60',parts0:.68,parts1:.82,hours:'2 HR',hours0:.80,hours1:.97},
  '04':{desc:'ENTRY DOOR SCREEN TEAR',descEnd:.70,parts:'15',parts0:.69,parts1:.82,hours:'.5',hours0:.80,hours1:.96},
  '16':{desc:'WBP',descEnd:.42,parts:'80',parts0:.46,parts1:.68,hours:'2.60 HR',hours0:.67,hours1:.96},
};
function norm(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9.]+/g,' ').replace(/\s+/g,' ').trim();}
function wer(a,b){a=norm(a).split(' ');b=norm(b).split(' ');const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]/Math.max(1,b.length);}
async function crop(im,x0,x1){const sh=im.toSharp();const left=Math.max(0,Math.floor(im.width*x0)),right=Math.min(im.width,Math.ceil(im.width*x1));const top=Math.min(8,Math.floor(im.height*.08)),height=Math.max(20,im.height-top*2);const buf=await sh.extract({left,top,width:right-left,height}).grayscale().normalize().resize({height:160,kernel:'lanczos3'}).jpeg({quality:94}).toBuffer();return RawImage.read(buf);}
const ocr=await pipeline('image-to-text','Xenova/trocr-base-handwritten',{dtype:'q8'});
let pass=0,total=0;
for(const row of rows){const s=specs[row.name];if(!s)continue;const p=`/tmp/${row.name}.jpg`;await fs.writeFile(p,Buffer.from(row.data,'base64'));const im=await RawImage.read(p);for(const [field,x0,x1,expected] of [['desc',.04,s.descEnd,s.desc],['parts',s.parts0,s.parts1,s.parts],['hours',s.hours0,s.hours1,s.hours]]){const c=await crop(im,x0,x1);const r=await ocr(c,{max_new_tokens:48});const got=(Array.isArray(r)?r[0]?.generated_text:r?.generated_text)||'';const e=wer(got,expected);const ok=e<=.34;total++;if(ok)pass++;console.log(JSON.stringify({row:row.name,field,expected,got,wer:+e.toFixed(3),pass:ok}));}}
console.log(`SUMMARY ${pass}/${total} pass`);if(pass<7)process.exit(2);
