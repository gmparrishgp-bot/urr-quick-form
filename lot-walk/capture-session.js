// Lot Walk capture session: Scan Now is a shutter. Save first, recognize in background.
(function(){
  const DB_NAME='lot-walk-session-v1',STORE='captures';
  const session={id:'',db:null,queue:[],processing:false,counts:{saved:0,processed:0,unresolved:0,error:0}};

  function makeId(){const a=new Uint32Array(3);crypto.getRandomValues(a);return `cap-${Date.now().toString(36)}-${[...a].map(x=>x.toString(36)).join('')}`;}
  function currentSessionId(){
    let id=sessionStorage.getItem('lotWalkSessionId');
    if(!id){id=`walk-${new Date().toISOString().slice(0,10)}-${Math.random().toString(36).slice(2,8)}`;sessionStorage.setItem('lotWalkSessionId',id);}
    return id;
  }
  function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'id'});s.createIndex('sessionId','sessionId');s.createIndex('status','status');}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  function put(rec){return new Promise((resolve,reject)=>{const tx=session.db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);tx.oncomplete=()=>resolve(rec);tx.onerror=()=>reject(tx.error);});}
  function allForSession(){return new Promise((resolve,reject)=>{const tx=session.db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).index('sessionId').getAll(session.id);req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
  function canvasFrom(source,max=1600){const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;if(!sw||!sh)throw Error('Camera frame not ready');const scale=Math.min(1,max/Math.max(sw,sh)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c;}
  function jpeg(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not save photo')),'image/jpeg',.84));}
  function imageFromBlob(blob){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(blob);img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Saved photo could not be reopened'))};img.src=url;});}
  function matchSummary(m){if(!m)return null;return{status:m.status||'',confidence:m.confidence||'',score:m.score||0,evidence:m.evidence||[],rows:(m.rows||[]).map(r=>({ro:r.ro||'',vin:r.vin||'',stock:r.stock||'',customer:r.customer||'',year:r.year||'',make:r.make||'',model:r.model||''}))};}
  function injectUI(){const area=$('scanAreaCard');if(!area)return;const card=document.createElement('div');card.id='captureSessionCard';card.className='card';card.innerHTML=`<div class="row"><b>Walk Session</b><span id="captureSummary" class="pill">0 photos</span></div><div id="captureStatus" class="muted" style="margin-top:6px">Scan Now saves a photo immediately. Recognition runs from the saved photos while you keep walking.</div><div id="captureRecent" style="margin-top:8px"></div>`;area.insertAdjacentElement('afterend',card);}
  async function refresh(){if(!session.db)return;const rows=(await allForSession()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));session.counts.saved=rows.length;session.counts.processed=rows.filter(r=>['MATCH','UNRESOLVED'].includes(r.status)).length;session.counts.unresolved=rows.filter(r=>r.status==='UNRESOLVED').length;session.counts.error=rows.filter(r=>r.status==='ERROR').length;if($('captureSummary'))$('captureSummary').textContent=`${rows.length} photos · ${session.counts.unresolved} unresolved`;if($('captureRecent'))$('captureRecent').innerHTML=rows.slice(0,4).map(r=>`<div class="testrow"><b>${r.area}</b> · ${r.status}${r.match?.rows?.length?` · RO ${r.match.rows.map(x=>x.ro).join('/')}`:''}<span class="muted"> · ${new Date(r.createdAt).toLocaleTimeString()}</span></div>`).join('');}
  async function saveCapture(source,area,{queue=true}={}){
    if(!['SERVICE','SALES'].includes(area))throw Error('Choose Service Area or Sales Area first');
    const c=canvasFrom(source),blob=await jpeg(c),rec={id:makeId(),sessionId:session.id,createdAt:new Date().toISOString(),area,status:'SAVED',blob,width:c.width,height:c.height};
    await put(rec);await refresh();
    if($('scanStatus'))$('scanStatus').textContent=`Photo saved · ${area} · move to next unit.`;
    if($('resultCard'))$('resultCard').classList.add('hidden');
    if(queue){session.queue.push(rec.id);setTimeout(processQueue,0);}return rec;
  }
  async function get(id){return new Promise((resolve,reject)=>{const tx=session.db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function processOne(id){let rec=await get(id);if(!rec||!rec.blob)return;rec.status='PROCESSING';await put(rec);try{const img=await imageFromBlob(rec.blob),scan=await window.lotWalkScanSourceV10(img,{render:false}),m=scan?.match||matchOCR(scan?.text||'');rec.match=matchSummary(m);rec.status=m?.status==='MATCH'?'MATCH':'UNRESOLVED';rec.read=scan?.text||'';rec.processedAt=new Date().toISOString();await put(rec);if(window.lotWalkPairing?.submitCapture)await window.lotWalkPairing.submitCapture(rec);}
    catch(e){rec.status='ERROR';rec.error=e.message;rec.processedAt=new Date().toISOString();await put(rec);console.error('capture processing',e);}await refresh();}
  async function processQueue(){if(session.processing)return;session.processing=true;try{while(session.queue.length)await processOne(session.queue.shift());}finally{session.processing=false;}}
  async function receiveRemote(meta,blob){const existing=await get(meta.id);const rec={...(existing||{}),...meta,sessionId:session.id,blob:blob||existing?.blob};await put(rec);await refresh();}
  async function scanNow(){
    if(!state.activeArea){$('scanStatus').textContent='Choose Service Area or Sales Area before scanning.';return;}
    if(!video.videoWidth||video.readyState<2){$('scanStatus').textContent='Camera is not ready yet. Tap Start Camera.';return;}
    const b=$('scanNow'),old=b.textContent;b.textContent='Saving…';b.disabled=true;
    try{await saveCapture(video,state.activeArea,{queue:true});}catch(e){$('scanStatus').textContent='Photo not saved: '+e.message;}finally{b.textContent=old;b.disabled=false;}
  }
  async function init(){session.id=currentSessionId();session.db=await openDb();injectUI();await refresh();$('scanNow').onclick=scanNow;window.lotWalkCaptureSession={saveCapture,processQueue,receiveRemote,all:allForSession,sessionId:()=>session.id,counts:()=>({...session.counts})};}
  init().catch(e=>{console.error(e);if($('scanStatus'))$('scanStatus').textContent='Session storage unavailable: '+e.message;});
})();