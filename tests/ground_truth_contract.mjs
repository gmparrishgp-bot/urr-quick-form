import fs from 'node:fs';
const gt=JSON.parse(fs.readFileSync('validation/ground-truth-105470.json','utf8'));
function calc(hours,parts){
  if(hours==null&&parts==null)return null;
  const raw=(Number(hours)||0)*199+(Number(parts)||0);
  return Math.ceil(raw/5)*5;
}
const errors=[];
if(gt.ro!=='105470')errors.push(`RO ${gt.ro}`);
if(gt.jobs.length!==16)errors.push(`job count ${gt.jobs.length}`);
for(const [i,j] of gt.jobs.entries()){
  if(j.num!==i+1)errors.push(`row order ${j.num} at ${i+1}`);
  const total=calc(j.hours,j.parts);
  if(total!==j.total)errors.push(`row ${j.num} total expected ${j.total} got ${total}`);
  const quoted=j.hours!=null||j.parts!=null;
  if(quoted&&j.status==='RECON')errors.push(`row ${j.num} quoted dollars/hours cannot be RECON`);
  if(j.status==='RECON'&&(j.hours!=null||j.parts!=null||j.total!=null))errors.push(`row ${j.num} RECON numeric fields not blank`);
  if(quoted&&j.status!=='APPROVED'&&j.status!=='DECLINED')errors.push(`row ${j.num} quoted row status ${j.status}`);
}
const approved=gt.jobs.filter(j=>j.status==='APPROVED');
if(approved.length!==1||approved[0].num!==7)errors.push(`approved rows ${approved.map(x=>x.num).join(',')}`);
for(const [h,p,t] of [[.5,30,130],[.2,25,65],[3.39,100,775],[0,80,80]]){
  const got=calc(h,p);if(got!==t)errors.push(`calc(${h},${p})=${got}, expected ${t}`);
}
console.log(JSON.stringify({ro:gt.ro,jobs:gt.jobs.length,approved:approved.map(j=>j.num),errors},null,2));
if(errors.length)process.exit(2);
