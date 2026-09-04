// Pairing UX hardening: a failed/stale connection must never make the phone look frozen.
(function(){
  const qs=new URLSearchParams(location.search);if(!qs.get('pair'))return;
  let connected=false,started=Date.now();
  function stateText(){return document.getElementById('pairState')?.textContent||'';}
  function phoneStatus(){return document.getElementById('phonePairStatus');}
  function ensureHelp(){
    const host=document.getElementById('phonePair');if(!host||document.getElementById('pairHelp'))return;
    const box=document.createElement('div');box.id='pairHelp';box.className='muted';box.style.marginTop='8px';box.innerHTML=`<div id="pairHelpText">The scanner can save photos on this phone even while the computer connection is unavailable.</div><div class="row" style="margin-top:8px"><button id="retryPair" class="secondary">Retry Connection</button></div>`;host.appendChild(box);
    document.getElementById('retryPair').onclick=()=>location.reload();
  }
  ensureHelp();
  const timer=setInterval(()=>{
    const s=stateText();
    if(s==='Paired'){
      connected=true;const el=phoneStatus();if(el)el.textContent='Paired to computer. Work orders loaded automatically.';const help=document.getElementById('pairHelpText');if(help)help.textContent='Connected. Saved photos and scan results will sync to the computer.';return;
    }
    if(connected&&s!=='Paired'){
      connected=false;const el=phoneStatus();if(el)el.textContent='Computer connection lost. Photos will keep saving on this phone and will sync after reconnection.';return;
    }
    if(!connected&&Date.now()-started>8000){
      const el=phoneStatus();if(el)el.textContent='Still not connected to the computer. You can keep taking or importing photos; they are saved on this phone.';
      const ps=document.getElementById('pairState');if(ps&&ps.textContent==='Connecting…')ps.textContent='Not connected';
      const help=document.getElementById('pairHelpText');if(help)help.textContent='If the computer still says Waiting for phone, tap Retry Connection. If it does not, generate a new Pair Phone QR on the computer and scan that new QR. Existing saved photos stay in this walk session.';
    }
  },1000);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
})();