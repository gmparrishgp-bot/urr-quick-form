const $=id=>document.getElementById(id);
const state={workOrders:[],stream:null,worker:null,scanning:false,lastBoxes:[],service:false,sales:false};
const video=$('video'),frame=$('frame'),overlay=$('overlay');

const FIXTURES=[
['845271','573TT2521T8845271',['104558','105380','105422'],'CONFIRMED'],
['1174','4M9BT181XT1201174',['104862'],'CONFIRMED'],
['4746','', ['104746'],'HIGH'],
['1606','',[],'UNRESOLVED'],
['0013','5ZT2AVTB9SB940013',['104849'],'CONFIRMED'],
['654376','573TE3224S6654376',['103515'],'CONFIRMED'],
['L3116','58TBP0BP1S17L3116',['105252'],'CONFIRMED'],
['839289','573TT3229T8839289',['105243'],'CONFIRMED'],
['838287','573TT3222S8838287',['103922'],'CONFIRMED'],
['3086','4YDT29526LD413086',['105237'],'CONFIRMED'],
['B3061','58TBP0BK1T11B3061',['105413'],'CONFIRMED'],
['0115','7JJTEWK24JA000115',['103507'],'CONFIRMED'],
['5612','4X4TVBZ21S4125612',['105049'],'CONFIRMED'],
['6893','',[],'UNRESOLVED'],
['437881','573TE2524R3437881',['105328'],'CONFIRMED'],
['8359','',[],'UNRESOLVED'],
['L3085','',[],'UNRESOLVED'],
['X43053','58TBP0AJ0T1X43053',['105211'],'CONFIRMED'],
['3745','7M5TD3328RC303745',['105205'],'CONFIRMED'],
['2787','4X4TWDH22TA282787',['103937','104699'],'CONFIRMED'],
['639182','573TE3229N6639182',['105149'],'CONFIRMED'],
['071862','WDAPF4CD6KN071862',['104502'],'CONFIRMED'],
['D1304','WDAPF4CD6KN071862',['104502'],'CONFIRMED'],
['711806','4X4FWBE23TV711806',['105416'],'CONFIRMED'],
['206542','7M5FP4223SB206542',['105292'],'CONFIRMED'],
['A21776','573FS4328SAA21776',['105238'],'CONFIRMED'],
['927739','573FR3820S9927739',['105354'],'CONFIRMED'],
['117959','573FM4431M1117959',['104282'],'CONFIRMED'],
['D02468','1FDWE3FN1TDD02468',['104350'],'CONFIRMED'],
['933358','4YDT27429KH933358',['105438'],'CONFIRMED'],
['103395','54CTT1T20T3103395',['104407'],'CONFIRMED']
];
const DEMO_ROWS=[
{ro:'104558',customer:'DIA WTY',year:'2026',make:'GRAND DESIGN',model:'TRANSCEND XPLOR 20MKX',vin:'573TT2521T8845271',stock:'',status:'OPEN'},
{ro:'105380',customer:'MATTHEW LANGFITT',year:'2026',make:'GRAND DESIGN',model:'TRANSCEND XPLOR 20MKX',vin:'573TT2521T8845271',stock:'',status:'OPEN'},
{ro:'105422',customer:'MATTHEW LANGFITT',year:'2026',make:'GRAND DESIGN',model:'TRANSCEND XPLOR 20MKX',vin:'573TT2521T8845271',stock:'',status:'OPEN'},
{ro:'104862',customer:'LEONARD HEINIGER',year:'2026',make:'WAYFINDER',model:'GO BEYOND LTD 171FD',vin:'4M9BT181XT1201174',stock:'',status:'OPEN'},
{ro:'104746',customer:'DIA WTY',year:'2026',make:'WAYFINDER',model:'GO LITE BOULDERBACK',vin:'7J3G1EB10TL053018',stock:'',status:'OPEN'},
{ro:'104849',customer:'KENDRA OBRIEN',year:'2025',make:'PRIME TIME',model:'AVENGER LE 28QBSLE',vin:'5ZT2AVTB9SB940013',stock:'',status:'OPEN'},
{ro:'103515',customer:'JOSHUA HATCHER',year:'2025',make:'GRAND DESIGN',model:'IMAGINE 2670MK',vin:'573TE3224S6654376',stock:'',status:'OPEN'},
{ro:'105252',customer:'TRISHA SNYDER',year:'2025',make:'WAYFINDER',model:'GO PLAY 26BHS-G',vin:'58TBP0BP1S17L3116',stock:'',status:'OPEN'},
{ro:'105243',customer:'DANIEL DUNCAN',year:'2026',make:'GRAND DESIGN',model:'TRANSCEND XPLOR 27DBX',vin:'573TT3229T8839289',stock:'',status:'OPEN'},
{ro:'103922',customer:'JORDAN LUNDIN',year:'2025',make:'GRAND DESIGN',model:'TRANSCEND XPLOR 26RBX',vin:'573TT3222S8838287',stock:'',status:'OPEN'},
{ro:'105237',customer:'SCOTT HALL',year:'2020',make:'KEYSTONE',model:'PASSPORT',vin:'4YDT29526LD413086',stock:'',status:'OPEN'},
{ro:'105413',customer:'JANE WOLFE',year:'2026',make:'HIGHLAND RIDGE',model:'GO EXPLORE',vin:'58TBP0BK1T11B3061',stock:'',status:'OPEN'},
{ro:'103507',customer:'JESSICA OVERMIRE',year:'2018',make:'EAST TO WEST',model:'DELLA TERRA 27KDB',vin:'7JJTEWK24JA000115',stock:'',status:'OPEN'},
{ro:'105049',customer:'DENNIS BOWREY',year:'2025',make:'FOREST RIVER',model:'VIBE 2400RB',vin:'4X4TVBZ21S4125612',stock:'',status:'OPEN'},
{ro:'105328',customer:'RONALD HANGER',year:'2024',make:'GRAND DESIGN',model:'IMAGINE XLS 22BHE',vin:'573TE2524R3437881',stock:'',status:'OPEN'},
{ro:'105211',customer:'JOHN DAVISSON',year:'2026',make:'WAYFINDER',model:'GO PLAY 17QB SPORT',vin:'58TBP0AJ0T1X43053',stock:'',status:'OPEN'},
{ro:'105205',customer:'TRAVIS KERKOVE',year:'2024',make:'ALLIANCE',model:'DELTA 292RL',vin:'7M5TD3328RC303745',stock:'',status:'OPEN'},
{ro:'103937',customer:'BROCK SEILER',year:'2026',make:'FOREST RIVER',model:'WILDWOOD 32BHDS',vin:'4X4TWDH22TA282787',stock:'',status:'OPEN'},
{ro:'104699',customer:'BROCK SEILER',year:'2026',make:'FOREST RIVER',model:'WILDWOOD 32BHDS',vin:'4X4TWDH22TA282787',stock:'',status:'OPEN'},
{ro:'105149',customer:'KARL MACOMB',year:'2022',make:'GRAND DESIGN',model:'IMAGINE 2670MK',vin:'573TE3229N6639182',stock:'',status:'OPEN'},
{ro:'104502',customer:'SCOTT JEFFRIES',year:'2020',make:'WINNEBAGO',model:'NAVION 24D',vin:'WDAPF4CD6KN071862',stock:'D1304',status:'OPEN'},
{ro:'105416',customer:'DONALD KERBS JR',year:'2026',make:'FOREST RIVER',model:'HERITAGE GLEN 286RL',vin:'4X4FWBE23TV711806',stock:'',status:'OPEN'},
{ro:'105292',customer:'MICHAEL BRYANT',year:'2025',make:'ALLIANCE',model:'PARADIGM 382RK',vin:'7M5FP4223SB206542',stock:'',status:'OPEN'},
{ro:'105238',customer:'ANDY DENNHARDT',year:'2025',make:'GRAND DESIGN',model:'SOLITUDE',vin:'573FS4328SAA21776',stock:'',status:'OPEN'},
{ro:'105354',customer:'STEVE KASTELEIN',year:'2025',make:'GRAND DESIGN',model:'REFLECTION 324MBS',vin:'573FR3820S9927739',stock:'',status:'OPEN'},
{ro:'104282',customer:'LARRY BLOOMER',year:'2021',make:'GRAND DESIGN',model:'MOMENTUM 395MS',vin:'573FM4431M1117959',stock:'',status:'OPEN'},
{ro:'104350',customer:'KATHY ANDERSON',year:'2026',make:'THOR',model:'QUANTUM LZ22',vin:'1FDWE3FN1TDD02468',stock:'',status:'OPEN'},
{ro:'105438',customer:'ALEX WATERKOTTE',year:'2019',make:'LANTERN',model:'274BHS',vin:'4YDT27429KH933358',stock:'',status:'OPEN'},
{ro:'104407',customer:"BISH'S RV OF DIA LOCATION",year:'2026',make:'WINNEBAGO',model:'THRIVE 25RLS',vin:'54CTT1T20T3103395',stock:'1043546',status:'OPEN'}
];

function norm(s){return String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function normWords(s){return String(s??'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function lev(a,b){a=norm(a);b=norm(b);const m=a.length,n=b.length;if(!m||!n)return Math.max(m,n);let p=[...Array(n+1).keys()];for(let i=1;i<=m;i++){let c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[n];}
function sim(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;return 1-lev(a,b)/Math.max(a.length,b.length);}
function suffixScore(clue,value){clue=norm(clue);value=norm(value);if(!clue||!value)return 0;if(value===clue)return 1;if(value.endsWith(clue)&&clue.length>=4)return Math.min(.98,.72+clue.length*.035);if(clue.endsWith(value)&&value.length>=4)return .7;return 0;}
function tokens(s){return normWords(s).split(' ').filter(x=>x.length>2);}
function textContainsClue(text,clue){const n=norm(text),c=norm(clue);return c&&n.includes(c);}

function normalizeRow(r){const key=k=>Object.keys(r).find(x=>normWords(x).replace(/ /g,'').includes(k));const get=(...names)=>{for(const n of names){const k=key(n);if(k&&r[k]!=null)return String(r[k]).trim();}return''};return{
 ro:get('RO#','RONUMBER','REPAIRORDER','RO'), customer:get('CUSTOMERNAME','CUSTOMER'), year:get('YEAR'), make:get('MAKE'), model:get('MODEL'), vin:get('VIN/SERIALNO','VINSERIAL','VIN','SERIALNO'), stock:get('STOCK#','STOCKNUMBER','STOCK'), status:get('ROSTATUS','STATUS'), category:get('CATEGORY')
};}
function setRows(rows,label=''){state.workOrders=rows.map(normalizeRow).filter(r=>r.ro||r.vin||r.stock||r.customer);$('dataCount').textContent=`${state.workOrders.length} WOs`;$('dataStatus').textContent=`Loaded ${state.workOrders.length} work orders${label?' from '+label:''}.`}

$('woFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});let rows=[];for(const s of wb.SheetNames)rows.push(...XLSX.utils.sheet_to_json(wb.Sheets[s],{defval:''}));setRows(rows,f.name);});
$('loadDemo').onclick=()=>setRows(DEMO_ROWS,'built-in regression data');

function extractClues(text){const raw=String(text||'').toUpperCase();const compact=raw.replace(/[^A-Z0-9]/g,'');const out=new Set();
 for(const m of raw.matchAll(/\b[A-HJ-NPR-Z0-9]{17}\b/g))out.add(m[0]);
 for(const m of raw.matchAll(/\b[A-Z]*\d[A-Z0-9]{3,9}\b/g))out.add(m[0]);
 for(const m of raw.matchAll(/\b\d{4,8}\b/g))out.add(m[0]);
 if(compact.length>=4&&compact.length<=20)out.add(compact);
 return [...out].filter(x=>x.length>=4);
}
function scoreRow(row,ocrText,clues){let score=0,e=[];const nt=norm(ocrText),words=normWords(ocrText);
 const vin=norm(row.vin),stock=norm(row.stock),ro=norm(row.ro);
 if(vin&&nt.includes(vin)){score+=120;e.push('full VIN');}
 for(const c of clues){const nc=norm(c);if(vin){const s=suffixScore(nc,vin);if(s>=.96){score+=90;e.push(`VIN ${c}`)}else if(s>=.83){score+=72;e.push(`VIN suffix ${c}`)}else if(s>=.70){score+=48;e.push(`partial VIN ${c}`)}}if(stock&&nc===stock){score+=78;e.push(`stock ${c}`)}else if(stock&&suffixScore(nc,stock)>.9){score+=58;e.push(`stock suffix ${c}`)}if(ro&&nc===ro){score+=66;e.push(`RO ${c}`)}}
 const makeTokens=tokens(row.make),modelTokens=tokens(row.model),cust=tokens(row.customer);let brandHits=0;for(const t of [...makeTokens,...modelTokens])if(words.includes(t)){brandHits++;score+=Math.min(8,t.length);}
 if(brandHits>=2)e.push('make/model context');
 let nameHits=0;for(const t of cust)if(words.includes(t)){nameHits++;score+=14;}if(nameHits)e.push('customer name');
 return{row,score,e:[...new Set(e)]};}
function matchOCR(text){if(!state.workOrders.length)return{status:'NO_DATA',text,results:[]};const clues=extractClues(text);let scored=state.workOrders.map(r=>scoreRow(r,text,clues)).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 if(!scored.length)return{status:'UNRESOLVED',text,clues,results:[]};const top=scored[0];const sameVin=top.row.vin?state.workOrders.filter(r=>norm(r.vin)===norm(top.row.vin)):[];const runner=scored[1];let confidence='LOW';if(top.score>=90&&( !runner||top.score-runner.score>=20))confidence='HIGH';else if(top.score>=60)confidence='MEDIUM';
 const related=sameVin.length?sameVin:[top.row];return{status:'MATCH',confidence,text,clues,score:top.score,evidence:top.e,rows:related,alternates:scored.slice(1,4)};}

function renderResult(m){$('resultCard').classList.remove('hidden');const el=$('result');el.className='match';if(m.status==='NO_DATA'){el.classList.add('low');el.innerHTML='<div class="big">Load open WOs first</div>';return;}if(m.status==='UNRESOLVED'){el.classList.add('mid');el.innerHTML=`<div class="big">Unknown / research</div><div>Read: ${escapeHtml(m.text||'No usable text')}</div><div class="muted">No defensible open-RO match. Do not classify as no-ticket yet.</div>`;return;}el.classList.add(m.confidence==='HIGH'?'high':'mid');const r=m.rows[0];el.innerHTML=`<div class="big">${m.confidence} match</div><div><b>${escapeHtml(r.year)} ${escapeHtml(r.make)} ${escapeHtml(r.model)}</b></div><div>RO(s): ${m.rows.map(x=>escapeHtml(x.ro)).join(', ')||'—'}</div><div>Customer: ${escapeHtml(r.customer)||'—'}</div><div>VIN: ${escapeHtml(r.vin)||'—'}</div><div>Stock: ${escapeHtml(r.stock)||'—'}</div><div class="muted">Evidence: ${m.evidence.map(escapeHtml).join(', ')} · score ${Math.round(m.score)}</div>${m.confidence!=='HIGH'&&m.alternates.length?`<div class="muted" style="margin-top:6px">Other candidates: ${m.alternates.map(x=>escapeHtml(x.row.ro+' '+x.row.make+' '+x.row.model)).join(' | ')}</div>`:''}`;}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function ensureWorker(){if(state.worker)return state.worker;$('scanStatus').textContent='Loading local text reader…';state.worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text')$('scanStatus').textContent=`Reading identifiers… ${Math.round((m.progress||0)*100)}%`;}});await state.worker.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- /',preserve_interword_spaces:'1'});return state.worker;}
function captureCanvas(source=video,max=1600){const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;if(!sw||!sh)throw Error('Image not ready');const scale=Math.min(1,max/Math.max(sw,sh));frame.width=Math.round(sw*scale);frame.height=Math.round(sh*scale);frame.getContext('2d').drawImage(source,0,0,frame.width,frame.height);return frame;}
function fallbackRegions(c){const W=c.width,H=c.height;return[{x:0,y:0,w:W,h:H,score:1},{x:0,y:0,w:W,h:Math.round(H*.45),score:.8},{x:0,y:Math.round(H*.4),w:W,h:Math.round(H*.6),score:.8},{x:Math.round(W*.15),y:Math.round(H*.1),w:Math.round(W*.7),h:Math.round(H*.8),score:.7}];}
function detectRegions(c){if(typeof cv==='undefined'||!cv.Mat)return fallbackRegions(c);let src=cv.imread(c),gray=new cv.Mat(),bin=new cv.Mat(),kernel=null,closed=new cv.Mat(),contours=new cv.MatVector(),hier=new cv.Mat();try{cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,gray,new cv.Size(3,3),0);cv.adaptiveThreshold(gray,bin,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,11);kernel=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(11,3));cv.morphologyEx(bin,closed,cv.MORPH_CLOSE,kernel);cv.findContours(closed,contours,hier,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);let boxes=[];for(let i=0;i<contours.size();i++){const r=cv.boundingRect(contours.get(i));const area=r.width*r.height,ratio=r.width/Math.max(1,r.height);if(area<c.width*c.height*.00025||area>c.width*c.height*.35)continue;if(r.width<28||r.height<10||ratio<1.2||ratio>28)continue;const pad=Math.round(Math.max(r.height*.8,8));boxes.push({x:Math.max(0,r.x-pad),y:Math.max(0,r.y-pad),w:Math.min(c.width-r.x+pad,r.width+pad*2),h:Math.min(c.height-r.y+pad,r.height+pad*2),score:area*(1+Math.min(ratio,8)/8)});}boxes.sort((a,b)=>b.score-a.score);const merged=[];for(const b of boxes){if(merged.some(m=>iou(m,b)>.45))continue;merged.push(b);if(merged.length>=10)break;}return merged.length?[...merged,...fallbackRegions(c).slice(0,1)]:fallbackRegions(c);}catch(e){console.warn(e);return fallbackRegions(c);}finally{src.delete();gray.delete();bin.delete();closed.delete();contours.delete();hier.delete();if(kernel)kernel.delete();}}
function iou(a,b){const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h);const inter=Math.max(0,x2-x1)*Math.max(0,y2-y1);return inter/(a.w*a.h+b.w*b.h-inter||1);}
function cropVariant(src,b,rot=0){const scale=Math.min(3,Math.max(1.5,900/Math.max(b.w,b.h)));const tmp=document.createElement('canvas'),ctx=tmp.getContext('2d');let w=Math.round(b.w*scale),h=Math.round(b.h*scale);if(Math.abs(rot)===90){tmp.width=h;tmp.height=w}else{tmp.width=w;tmp.height=h}ctx.translate(tmp.width/2,tmp.height/2);ctx.rotate(rot*Math.PI/180);ctx.filter='grayscale(1) contrast(1.45)';ctx.drawImage(src,b.x,b.y,b.w,b.h,-w/2,-h/2,w,h);return tmp;}
function drawBoxes(boxes){const ctx=overlay.getContext('2d');overlay.width=video.clientWidth;overlay.height=video.clientHeight;ctx.clearRect(0,0,overlay.width,overlay.height);if(!video.videoWidth)return;const sx=overlay.width/frame.width,sy=overlay.height/frame.height;ctx.strokeStyle='#22c55e';ctx.lineWidth=2;for(const b of boxes.slice(0,6))ctx.strokeRect(b.x*sx,b.y*sy,b.w*sx,b.h*sy);}
async function readImage(source){if(state.scanning)return;state.scanning=true;try{const c=captureCanvas(source);const regions=detectRegions(c);state.lastBoxes=regions;drawBoxes(regions);const worker=await ensureWorker();let texts=[];const top=regions.slice(0,7);for(let i=0;i<top.length;i++){for(const rot of [0,90,-90,180]){const v=cropVariant(c,top[i],rot);const res=await worker.recognize(v);const t=(res.data.text||'').trim();if(t)texts.push({t,conf:res.data.confidence||0});if(extractClues(t).some(x=>x.length>=6)&&res.data.confidence>45)break;}if(i>=2&&texts.some(x=>x.conf>65&&extractClues(x.t).length))break;}const combined=texts.sort((a,b)=>b.conf-a.conf).map(x=>x.t).join(' ');$('scanStatus').textContent=combined?`Read: ${combined.slice(0,140)}`:'No usable identifier read. Try one closer frame.';renderResult(matchOCR(combined));return combined;}catch(e){console.error(e);$('scanStatus').textContent='Scan failed: '+e.message;}finally{state.scanning=false;}}

$('startCam').onclick=async()=>{try{if(state.stream)state.stream.getTracks().forEach(t=>t.stop());state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});video.srcObject=state.stream;$('scanStatus').textContent='Camera ready. Hold naturally; the scanner searches the whole frame.';}catch(e){$('scanStatus').textContent='Camera unavailable: '+e.message;}};
$('scanNow').onclick=()=>readImage(video);
$('photoFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>readImage(img);img.src=URL.createObjectURL(f);});
$('rescan').onclick=()=>{ $('resultCard').classList.add('hidden');$('scanStatus').textContent='Ready for next scan.';};
$('proceed').onclick=()=>{ $('resultCard').classList.add('hidden');$('scanStatus').textContent='Proceed — ready for next unit.';};
$('serviceToggle').onclick=()=>{state.service=!state.service;$('serviceToggle').textContent=`Service Area Scanned: ${state.service?'Yes':'No'}`;$('serviceToggle').className=state.service?'good':'secondary'};
$('salesToggle').onclick=()=>{state.sales=!state.sales;$('salesToggle').textContent=`Sales Area Scanned: ${state.sales?'Yes':'No'}`;$('salesToggle').className=state.sales?'good':'secondary'};

function expectedFor(clue){return FIXTURES.find(x=>norm(x[0])===norm(clue));}
$('runTests').onclick=()=>{setRows(DEMO_ROWS,'built-in regression data');let pass=0,rows=[];for(const [clue,vin,ros,status] of FIXTURES){if(['1606','6893','8359','L3085'].includes(clue)){const m=matchOCR(clue);const ok=m.status==='UNRESOLVED'||(m.status==='MATCH'&&m.confidence!=='HIGH');if(ok)pass++;rows.push({clue,ok,msg:ok?'stays unresolved':'false confident match'});continue;}const m=matchOCR(clue);const got=m.status==='MATCH'?m.rows.map(r=>r.ro).sort():[];const need=[...ros].sort();const ok=m.status==='MATCH'&&need.every(x=>got.includes(x))&&(vin?norm(m.rows[0].vin)===norm(vin):true);if(ok)pass++;rows.push({clue,ok,msg:ok?`RO ${got.join('/')}`:`got ${got.join('/')||'none'}`});}$('testSummary').innerHTML=`<b>${pass}/${FIXTURES.length} deterministic matching checks passed.</b>`;$('testResults').innerHTML=rows.map(r=>`<div class="testrow ${r.ok?'pass':'fail'}">${r.ok?'PASS':'FAIL'} · ${escapeHtml(r.clue)} · ${escapeHtml(r.msg)}</div>`).join('');};
$('fixtureFiles').addEventListener('change',async e=>{const files=[...e.target.files];if(!files.length)return;if(!state.workOrders.length)setRows(DEMO_ROWS,'built-in regression data');let pass=0,checked=0,out=[];for(const f of files){const base=f.name;const expectedNameMap={
'20260722_110426.jpg':'845271','20260722_110507.jpg':'845271','20260722_120928.jpg':'1174','20260722_120934.jpg':'4746','20260722_120941.jpg':'1606','20260722_120948.jpg':'0013','20260722_120952.jpg':'654376','20260722_120957.jpg':'L3116','20260722_121000.jpg':'839289','20260722_121003.jpg':'838287','20260722_121009.jpg':'3086','20260722_121016.jpg':'B3061','20260722_121022.jpg':'0115','20260722_121027.jpg':'5612','20260722_121031.jpg':'6893','20260722_121037.jpg':'437881','20260722_121042.jpg':'8359','20260722_121047.jpg':'L3085','20260722_121052.jpg':'X43053','20260722_121055.jpg':'3745','20260722_121100.jpg':'2787','20260722_121104.jpg':'639182','20260722_140300.jpg':'071862','20260722_140346.jpg':'071862','20260722_140407.jpg':'D1304','20260722_140424.jpg':'711806','20260722_140530.jpg':'206542','20260722_140926.jpg':'A21776','20260722_141033.jpg':'A21776','20260722_141046.jpg':'927739','20260722_141328.jpg':'117959','20260722_141347.jpg':'D02468','20260722_141402.jpg':'933358','20260722_141521.jpg':'103395'};const clue=expectedNameMap[base];if(!clue){out.push(`<div class="testrow">SKIP · ${escapeHtml(base)} · no corrected-answer mapping</div>`);continue;}checked++;const img=new Image();const url=URL.createObjectURL(f);await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});const text=await readImage(img);const m=matchOCR(text);const exp=expectedFor(clue);let ok=false;if(exp[3]==='UNRESOLVED')ok=m.status==='UNRESOLVED'||(m.status==='MATCH'&&m.confidence!=='HIGH');else if(m.status==='MATCH')ok=exp[2].every(ro=>m.rows.some(r=>r.ro===ro));if(ok)pass++;out.push(`<div class="testrow ${ok?'pass':'fail'}">${ok?'PASS':'FAIL'} · ${escapeHtml(base)} · expected ${escapeHtml(clue)} · read ${escapeHtml(text.slice(0,70))}</div>`);URL.revokeObjectURL(url);}$('testSummary').innerHTML=`<b>Historical-photo regression: ${pass}/${checked} mapped files passed.</b>`;$('testResults').innerHTML=out.join('');});

window.addEventListener('beforeunload',()=>{if(state.stream)state.stream.getTracks().forEach(t=>t.stop());if(state.worker)state.worker.terminate();});
