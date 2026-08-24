"use strict";
// R21: domain correction layer learned from actual URR handwriting examples.
// This layer does NOT invent a repair when the handwriting reader has no evidence.
// It only normalizes/corrects text that was already read from a row.
(function(){
  const WORDS = (`rear front left right side ds ods exterior interior trim reseal seal sealed loose slide slideout awning roof cap transition rotten docking light lights chassis battery batteries safety equipment expired replace water heater pressure relief valve tanks fabric upholstery detail carpet furnace detector detectors smoke lp propane window blind broken fender skirt bedroom bathroom toilet leaking remote panel holes spot wbp wheel bearing pack door handrail shower corner gutter spout missing fridge refrigerator drain tube bracket bent remove walls bowed compartment latch lock handle vent flapper tabs fascia outside kitchen cabinets cabinet touch up ceiling regulator flow main entry screen canvas motor jack steps clearance marker decal couch table strut floor lino linoleum drawer shade pump faucet sink converter inverter solar breaker fuse outlet gfci gfi leak cracked damaged secure adjust patch membrane skylight shroud bumper frame tongue pin box fresh gravity fill city connection coupler hitch receiver sway suspension spring equalizer stabilizer leveling thermostat generator shore cord plug socket wire wiring harness sensor hose filter bedroom bunk room smoke batteries ceiling kitchen adjustment touchup expired date out of replace repair cracked tear torn wiper seal screen shower broken blind detector`).split(/\s+/);
  const WORDSET = new Set(WORDS);
  const PHRASES = [
    "roof front seal",
    "roof cap seal",
    "ods exterior trim reseal",
    "ds exterior trim reseal",
    "entry door screen tear",
    "entry door screen torn",
    "exterior shower broken",
    "ods rear slide wiper seal replace",
    "ds rear slide wiper seal replace",
    "lp detector out of date replace",
    "lp detector expired replace",
    "bunk window blind broken",
    "smoke detector batteries",
    "slide ceiling trim loose",
    "kitchen trim loose",
    "kitchen blind adjustment",
    "bunk room trim loose",
    "bedroom door touch up",
    "cabinets door touch up",
    "cabinet door touch up",
    "wheel bearing pack",
    "wbp"
  ];
  function norm(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
  function ed(a,b){a=String(a);b=String(b);const m=a.length,n=b.length,d=Array(n+1);for(let j=0;j<=n;j++)d[j]=j;for(let i=1;i<=m;i++){let p=d[0];d[0]=i;for(let j=1;j<=n;j++){const o=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=o;}}return d[n];}
  function tokenCorrect(tok){
    const low=tok.toLowerCase();
    if(WORDSET.has(low)||low.length<4)return tok;
    let best=low,bd=99;
    for(const w of WORDS){
      if(Math.abs(w.length-low.length)>2)continue;
      const d=ed(low,w);if(d<bd){bd=d;best=w;}
    }
    const limit=low.length>=9?2:low.length>=6?1:1;
    return bd<=limit?best:tok;
  }
  function tokenSimilarity(a,b){
    const A=norm(a).split(" ").filter(Boolean),B=norm(b).split(" ").filter(Boolean);
    if(!A.length||!B.length)return 0;
    let matched=0,weight=0;
    for(const x of A){
      let best=0;
      for(const y of B){
        const mx=Math.max(x.length,y.length);if(!mx)continue;
        const s=1-ed(x,y)/mx;if(s>best)best=s;
      }
      const wt=Math.max(1,Math.min(8,x.length));weight+=wt;matched+=best*wt;
    }
    const coverage=Math.min(A.length,B.length)/Math.max(A.length,B.length);
    return (matched/Math.max(1,weight))*.78+coverage*.22;
  }
  function phraseRepair(s){
    const base=norm(s);if(base.length<4)return s;
    let best="",bs=0;
    for(const p of PHRASES){
      const sc=tokenSimilarity(base,p);
      // Require at least one recognizable anchor token; prevents phrase hallucination.
      const anchors=p.split(" ").filter(x=>x.length>=4);
      const hasAnchor=anchors.some(a=>base.split(" ").some(t=>1-ed(t,a)/Math.max(t.length,a.length)>=.67));
      if(hasAnchor&&sc>bs){bs=sc;best=p;}
    }
    // Only use a phrase template when the read is already substantially similar.
    if(best&&bs>=.76)return best.toUpperCase()==="WBP"?"WBP":best.replace(/\bods\b/ig,"ODS").replace(/\bds\b/ig,"DS").replace(/\bwbp\b/ig,"WBP");
    return s;
  }
  function learnedCorrect(s){
    let v=String(s||"")
      .replace(/\boff\s*door\s*side\b/ig,"ODS")
      .replace(/\bdriver\s*side\b/ig,"ODS")
      .replace(/\bdoor\s*side\b/ig,"DS")
      .replace(/\bcurb\s*side\b/ig,"DS")
      .replace(/\bwheel\s*bearing\s*(?:pack|repack)\b/ig,"WBP")
      .replace(/\btouch[ -]?up\b/ig,"touch up")
      .replace(/\bout\s+of\s+(?:date|dates)\b/ig,"out of date");
    v=v.split(/(\s+|[^A-Za-z0-9/.-]+)/).map(part=>/^[A-Za-z]{4,}$/.test(part)?tokenCorrect(part):part).join("").replace(/\s+/g," ").trim();
    v=phraseRepair(v);
    return v;
  }
  // Replace the R20 corrector after the main bundle has loaded. Existing calls resolve
  // the global binding at runtime, so every future photo uses this learned layer.
  try{ correctRVText = learnedCorrect; }catch(e){ window.correctRVText = learnedCorrect; }

  // Lightweight deterministic benchmark of the correction layer. This is intentionally
  // separate from the image-model test: it verifies we improve typical handwriting OCR
  // corruption without fabricating unrelated repair text.
  const CASES=[
    ["ODS exterioe trm resea","ODS exterior trim reseal"],
    ["LP detecfor out of dote replc","lp detector out of date replace"],
    ["bunk wndow blind brokn","bunk window blind broken"],
    ["smoke detecfor baterys","smoke detector batteries"],
    ["slide ceilng trm lose","slide ceiling trim loose"],
    ["kitchn blind adjustmnt","kitchen blind adjustment"],
    ["bedrom dor touch up","bedroom door touch up"],
    ["wheell bearing pack","WBP"],
    ["generator fuel pump leaking","generator fuel pump leaking"]
  ];
  let pass=0;
  const results=CASES.map(([input,expected])=>{const got=learnedCorrect(input);const ok=norm(got)===norm(expected);if(ok)pass++;return{input,expected,got,ok};});
  window.URR_R21_DOMAIN_TEST={pass,total:CASES.length,results};
  console.info(`URR R21 domain correction benchmark: ${pass}/${CASES.length}`,results);
})();