// Add public STUN/TURN relay candidates to PeerJS so phone<->computer pairing can cross strict NAT/firewalls.
(function(){
  const BasePeer=window.Peer;if(typeof BasePeer!=='function')return;
  const iceServers=[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'stun:openrelay.metered.ca:80'},
    {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}
  ];
  function ReliablePeer(id,options){const o={...(options||{})};o.config={...(o.config||{}),iceServers:[...iceServers,...(o.config?.iceServers||[])]};return new BasePeer(id,o);}
  ReliablePeer.prototype=BasePeer.prototype;
  for(const k of Object.keys(BasePeer))try{ReliablePeer[k]=BasePeer[k]}catch{}
  window.Peer=ReliablePeer;
  window.lotWalkIceServers=iceServers.map(x=>x.urls);
})();