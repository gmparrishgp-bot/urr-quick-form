import fs from 'node:fs/promises';

const token=process.env.GITHUB_TOKEN;
if(!token) throw new Error('GITHUB_TOKEN missing');
const model=process.env.URR_VISION_MODEL || 'openai/gpt-4.1';
const fixtures=[
  ['105470','validation/actual-sheet-105470-preview.jpg'],
  ['reg2','validation/reg2-decoded.jpg'],
];

const prompt=`You are reading a real Bish's RV Used Recommended Repairs (URR) handwritten sheet. Read the image visually, not by guessing from typical RV work. Return ONLY valid JSON with this shape: {"ro":"","jobs":[{"num":1,"title":"","parts":null,"hours":null,"sheet_status":""}]}. Extract EVERY populated repair line in reading order; row count is dynamic. Preserve handwritten labor decimals exactly, especially .2, .5, 2.60 and .75. PARTS dollars and LABOR HOURS are separate columns: never fuse them. Do not calculate totals. Use sheet_status only when the sheet explicitly marks APPROVED, DECLINED, RECON, NOTE, or equivalent; otherwise empty string. Normalize door side to DS, off-door side to ODS, and wheel bearing pack to WBP. Do not invent missing lines.`;

function extractJSON(s){const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)return null;try{return JSON.parse(s.slice(a,b+1));}catch{return null;}}
for(const [name,path] of fixtures){
  const b64=(await fs.readFile(path)).toString('base64');
  const body={model,messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:`data:image/jpeg;base64,${b64}`,detail:'high'}}]}],temperature:0,max_tokens:3000};
  const t0=Date.now();
  const r=await fetch('https://models.github.ai/inference/chat/completions',{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},
    body:JSON.stringify(body)
  });
  const text=await r.text();
  if(!r.ok){console.error(name,'HTTP',r.status,text);process.exitCode=2;continue;}
  const envelope=JSON.parse(text);
  const out=envelope.choices?.[0]?.message?.content||'';
  const parsed=extractJSON(out);
  console.log(JSON.stringify({fixture:name,model,elapsed_ms:Date.now()-t0,parsed,raw:parsed?undefined:out}));
  if(!parsed) process.exitCode=2;
}
