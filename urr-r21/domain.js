"use strict";
// R21 adaptive URR handwriting correction.
// Rules: never create a repair from no OCR evidence; only normalize a read that already exists.
(function(){
  const WORDS = (`rear front left right back top middle side ds ods exterior interior trim reseal seal sealed loose slide slideout awning roof cap overlay transition rotten docking light lights chassis battery batteries safety equipment expired replace water heater pressure relief valve tanks fabric upholstery detail carpet furnace detector detectors smoke lp propane window blind broken fender skirt bedroom bathroom bunk room toilet leaking remote remotes panel holes spot wbp wheel bearing repack pack door handrail shower corner gutter spout missing fridge refrigerator refer drain tube bracket bent remove walls wall bowed compartment latch lock handle vent flapper tabs fascia outside kitchen cabinets cabinet touch up ceiling regulator flow main entry screen canvas motor jack jacks leveling steps clearance marker decal couch table strut floor lino linoleum drawer shade pump faucet sink converter inverter solar breaker fuse outlet gfci gfi leak leaks cracked cracks damaged damage secure adjust adjustment patch membrane skylight shroud bumper frame tongue pin box fresh gravity fill city connection coupler hitch receiver sway suspension spring equalizer stabilizer leveling thermostat generator shore cord plug socket wire wiring harness sensor hose filter tires tire flat flats date dates out of maintenance speakers working warped stile knob ac p trap hookup lid tear tears torn soft screw wood knicks condition bad needs three other cut`).split(/\s+/);
  const WORDSET=new Set(WORDS);
  const SEED_PHRASES=[
    "roof spot seal","roof sealant repairs","roof seals not in good condition","roof seals bad","roof overlay",
    "ODS exterior trim reseal","DS exterior trim reseal","exterior trim and wheel-well sealant repairs",
    "entry door screen tear","entry door has cracks","screen door does not stay latched",
    "exterior shower broken","shower P trap leaks","shower surround push pins detached",
    "ODS rear slide wiper seal replace","back ODS slide floor is soft","middle ODS slide floor is soft",
    "LP detector out of date replace","LP tanks expired","LP regulator bad","LP tank out of date",
    "bunk window blind broken","smoke detector batteries","slide ceiling trim loose","kitchen trim loose",
    "kitchen blind adjustment","bunk room trim loose","bedroom door touch up","cabinet door touch up","cabinets door touch up",
    "WBP","bearing repack","needs wheel repack","skylight shroud is cracked","no remotes","small hole in awning",
    "tanks ready 2/3 needs tank flush","missing leveling jack","livingroom TV won't turn on","other three tires are bad",
    "two flat tires","AC maintenance","cut in front compartment","awning speakers not working","water hook up lid is broken",
    "all seals cracking","exterior dents and scratches","knob missing on AC","knicks in wood","awning canvas has tears damage",
    "stile below refer warped","front docking light needs resealed"
  ];
  function norm(s){return String(s||"").toLowerCase().replace(/\b(?:driver|street)\s*side\b/g,"ods").replace(/\b(?:curb|door)\s*side\b/g,"ds").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
  function ed(a,b){a=String(a);b=String(b);const m=a.length,n=b.length,d=Array(n+1);for(let j=0;j<=n;j++)d[j]=j;for(let i=1;i<=m;i++){let p=d[0];d[0]=i;for(let j=1;j<=n;j++){const o=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=o;}}return d[n];}
  function tokenCorrect(tok){const low=tok.toLowerCase();if(WORDSET.has(low)||low.length<4)return tok;let best=low,bd=99;for(const w of WORDS){if(Math.abs(w.length-low.length)>3)continue;const d=ed(low,w);if(d<bd){bd=d;best=w;}}const limit=low.length>=9?2:1;return bd<=limit?best:tok;}
  function tokenSimilarity(a,b){const A=norm(a).split(" ").filter(Boolean),B=norm(b).split(" ").filter(Boolean);if(!A.length||!B.length)return 0;let matched=0,weight=0;for(const x of A){let best=0;for(const y of B){const mx=Math.max(x.length,y.length);const s=mx?1-ed(x,y)/mx:0;if(s>best)best=s;}const wt=Math.max(1,Math.min(8,x.length));weight+=wt;matched+=best*wt;}const coverage=Math.min(A.length,B.length)/Math.max(A.length,B.length);return matched/Math.max(1,weight)*.78+coverage*.22;}
  function anchorMatch(a,b){const A=norm(a).split(" "),B=norm(b).split(" ").filter(x=>x.length>=4);return B.some(x=>A.some(t=>1-ed(t,x)/Math.max(t.length,x.length)>=.70));}
  const LS_KEY="urr.learned.repair.corrections.v1";
  function loadLearned(){try{const x=JSON.parse(localStorage.getItem(LS_KEY)||"[]");return Array.isArray(x)?x.filter(v=>v&&v.raw&&v.corrected).slice(-250):[];}catch{return[];}}
  let learned=loadLearned();
  function saveLearned(){try{localStorage.setItem(LS_KEY,JSON.stringify(learned.slice(-250)));}catch{}}
  function learn(raw,corrected){raw=String(raw||"").trim();corrected=String(corrected||"").trim();if(!raw||!corrected||/^\[HANDWRITING/i.test(raw)||norm(raw)===norm(corrected))return false;const n=norm(raw);learned=learned.filter(x=>norm(x.raw)!==n);learned.push({raw,corrected,ts:Date.now()});saveLearned();return true;}
  function phraseRepair(s){const base=norm(s);if(base.length<4)return s;const candidates=[...learned.map(x=>({phrase:x.corrected,raw:x.raw,learned:true})),...SEED_PHRASES.map(x=>({phrase:x,raw:x,learned:false}))];let best=null,bs=0;for(const c of candidates){const compare=c.learned?c.raw:c.phrase;const sc=tokenSimilarity(base,compare);if(anchorMatch(base,compare)&&sc>bs){bs=sc;best=c;}}const threshold=best?.learned?.82:.76;if(best&&bs>=threshold)return best.phrase;return s;}
  function learnedCorrect(s){
    let v=String(s||"")
      // Observed PP-OCR handwriting confusions from URR validation. These replacements
      // require the surrounding token shape; they are not free-form guesses.
      .replace(/\bres3o[il1]\b/ig,"reseal")
      .replace(/\bda\$es\b/ig,"dates")
      .replace(/\bree?iarce\b/ig,"replace")
      .replace(/\boff\s*door\s*side\b/ig,"ODS").replace(/\bdriver\s*side\b/ig,"ODS").replace(/\bstreet\s*side\b/ig,"ODS")
      .replace(/\bdoor\s*side\b/ig,"DS").replace(/\bcurb\s*side\b/ig,"DS")
      .replace(/\bwheel\s*bearing\s*(?:pack|repack)\b/ig,"WBP").replace(/\btouch[ -]?up\b/ig,"touch up").replace(/\bout\s+of\s+(?:date|dates)\b/ig,"out of date");
    v=v.split(/(\s+|[^A-Za-z0-9/.'-]+)/).map(part=>/^[A-Za-z]{4,}$/.test(part)?tokenCorrect(part):part).join("").replace(/\s+/g," ").trim();
    v=phraseRepair(v).replace(/\bwheel\s+bearing\s+(?:pack|repack)\b/ig,"WBP");
    return v;
  }
  try{correctRVText=learnedCorrect;}catch(e){window.correctRVText=learnedCorrect;}
  window.URR_LEARN={learn,correct:learnedCorrect,count:()=>learned.length,clear:()=>{learned=[];saveLearned();}};

  const CASES=[
    ["ODS exterioe trm resea","ODS exterior trim reseal"],
    ["LP detecfor out of dote replc","LP detector out of date replace"],
    ["bunk wndow blind brokn","bunk window blind broken"],
    ["smoke detecfor baterys","smoke detector batteries"],
    ["slide ceilng trm lose","slide ceiling trim loose"],
    ["kitchn blind adjustmnt","kitchen blind adjustment"],
    ["bedrom dor touch up","bedroom door touch up"],
    ["wheell bearing pack","WBP"],
    ["back ODS slide flor is sof","back ODS slide floor is soft"],
    ["shower p trp leeks","shower P trap leaks"],
    ["ODS EXTERIOR TRIM RES3oL","ODS exterior trim reseal"],
    ["LP DETECTOR OUT OF DA$ES REeIARCE","LP detector out of date replace"],
    ["generator fuel pump leaking","generator fuel pump leaking"]
  ];
  let pass=0;const results=CASES.map(([input,expected])=>{const got=learnedCorrect(input),ok=norm(got)===norm(expected);if(ok)pass++;return{input,expected,got,ok};});
  window.URR_R21_DOMAIN_TEST={pass,total:CASES.length,results};
  console.info(`URR adaptive domain benchmark: ${pass}/${CASES.length}`,results);
})();