// PeerJS configuration and stage diagnostics. Must load after PeerJS and before pairing.js.
(function(){
  const NativePeer=window.Peer;
  if(typeof NativePeer!=='function')return;
  const ICE={iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turns:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'}
  ],sdpSemantics:'unified-plan'};
  const isPhone=new URLSearchParams(location.search).has('pair');
  const peers=[];
  function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}
  function stage(text){
    if(isPhone)setText('phonePairStatus',text);
    console.info('[LotWalk pairing]',text);
  }
  function ConfiguredPeer(id,opts){
    const options={...(opts||{}),config:{...ICE,...((opts||{}).config||{})},debug:2};
    const p=new NativePeer(id,options);peers.push(p);
    let opened=false;
    const timer=setTimeout(()=>{if(!opened&&!p.destroyed){stage('Cannot reach the pairing service. The phone and computer have not completed the handshake.');setText('pairState','Signaling failed');}},8000);
    p.on('open',peerId=>{opened=true;clearTimeout(timer);if(isPhone)stage('Pairing service reached. Connecting to computer…');console.info('[LotWalk pairing] peer open',peerId);});
    p.on('disconnected',()=>{stage('Pairing service disconnected. Retrying…');try{if(!p.destroyed)p.reconnect();}catch(e){console.warn(e);}});
    p.on('error',err=>{console.error('[LotWalk pairing] peer error',err?.type,err);if(isPhone){const type=err?.type||'connection error';stage(`Pairing error: ${type}.`);}setText('pairState',`Error: ${err?.type||'connection'}`);});
    return p;
  }
  ConfiguredPeer.prototype=NativePeer.prototype;
  Object.setPrototypeOf(ConfiguredPeer,NativePeer);
  window.Peer=ConfiguredPeer;
  window.lotWalkPeerDiagnostics={peers,ice:ICE};
})();
