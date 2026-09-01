// Lot Walk Scanner v4: staged whole-frame + line-aware bright-on-dark prepass before v3 fallback.
(function(){
  const fallback=window.lotWalkScanSourceV3||window.lotWalkScanSourceV2;
  let busy=false;
  function copy(source,max=2400){const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;if(!sw||!sh)throw Error('Image not ready');const s=Math.min(1,max/Math.max(sw,sh)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*s));c.height=Math.max(1,Math.round(sh*s));c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c;}
  function rotate(src,deg){const q=Math.abs(deg)%180===90,c=document.createElement('canvas');c.width=q?src.height:src.width;c.height=q?src.width:src.height;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);x.drawImage(src,-src.width/2,-src.height/2);return c;}
  function lineZones(src){
    const max=700,s=Math.min(1,max/Math.max(src.width,src.height)),p=document.createElement('canvas');p.width=Math.max(1,Math.round(src.width*s));p.height=Math.max(1,Math.round(src.height*s));const x=p.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,p.width,p.height);const d=x.getImageData(0,0,p.width,p.height).data,W=p.width,H=p.height,out=[];const widths=[.20,.24,.34,.46],heights=[.055,.07,.10,.13];
    for(const wf of widths)for(const hf of heights){const ww=Math.max(64,Math.round(W*wf)),hh=Math.max(24,Math.round(H*hf)),sx=Math.max(18,Math.round(ww*.25)),sy=Math.max(12,Math.round(hh*.32));for(let y=0;y+hh<H;y+=sy)for(let xx=0;xx+ww<W;xx+=sx){let n=0,sum=0,sum2=0,bright=0,dark=0;for(let yy=y;yy<y+hh;yy+=4)for(let px=xx;px<xx+ww;px+=4){const i=(yy*W+px)*4,v=.299*d[i]+.587*d[i+1]+.114*d[i+2];n++;sum+=v;sum2+=v*v;if(v>170)bright++;if(v<95)dark++;}const mean=sum/n,sd=Math.sqrt(Math.max(0,sum2/n-mean*mean)),bf=bright/n,df=dark/n;if(mean>155||sd<20||bf<.004||bf>.40||df<.14)continue;const general=(155-mean)*.28+sd*.48+bf*105+df*22;const sparse=(112-mean)*.35+sd*.35+Math.min(bf,.06)*500+df*12-Math.max(0,bf-.08)*520;out.push({x:xx/s,y:y/s,w:ww/s,h:hh/s,general,sparse,score:Math.max(general,sparse)});}}
    const choose=(key,limit)=>{const sorted=out.slice().sort((a,b)=>b[key]-a[key]),keep=[];for(const b of sorted){if(keep.some(k=>Math.abs(k.x-b.x)<Math.min(k.w,b.w)*.28&&Math.abs(k.y-b.y)<Math.min(k.h,b.h)*.48))continue;keep.push(b);if(keep.length>=limit)break;}return keep;};
    const merged=[...choose('sparse',10),...choose('general',5)],keep=[];for(const b of merged){if(keep.some(k=>Math.abs(k.x-b.x)<Math.min(k.w,b.w)*.18&&Math.abs(k.y-b.y)<Math.min(k.h,b.h)*.28))continue;keep.push(b);}return keep.slice(0,12);
  }
  function crop(src,b,scale=6){const pad=Math.round(Math.max(7,b.h*.16)),sx=Math.max(0,Math.round(b.x-pad)),sy=Math.max(0,Math.round(b.y-pad)),sw=Math.max(1,Math.min(src.width-sx,Math.round(b.w+pad*2))),sh=Math.max(1,Math.min(src.height-sy,Math.round(b.h+pad*2))),c=document.createElement('canvas');c.width=Math.round(sw*scale);c.height=Math.round(sh*scale);const x=c.getContext('2d');x.filter='grayscale(1) contrast(2.05)';x.drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);return c;}
  function chalkify(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0);const im=x.getImageData(0,0,c.width,c.height),d=im.data;let n=0,sum=0,sum2=0;for(let i=0;i<d.length;i+=16){const v=.299*d[i]+.587*d[i+1]+.114*d[i+2];n++;sum+=v;sum2+=v*v;}const mean=sum/n,sd=Math.sqrt(Math.max(0,sum2/n-mean*mean)),thr=Math.max(92,Math.min(205,mean+Math.max(20,sd*.48)));const W=c.width,H=c.height,m=new Uint8Array(W*H);for(let p=0,i=0;i<d.length;i+=4,p++){const v=.299*d[i]+.587*d[i+1]+.114*d[i+2];m[p]=v>=thr?1:0;}for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){let on=false;for(let dy=-1;dy<=1&&!on;dy++)for(let dx=-1;dx<=1;dx++){const nx=xx+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<W&&ny<H&&m[ny*W+nx]){on=true;break;}}const i=(y*W+xx)*4,v=on?0:255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}x.putImageData(im,0,0);return c;}
  async function worker(){if(!state.worker)state.worker=await Tesseract.createWorker('eng',1);return state.worker;}
  async function ocr(c,psm){const w=await worker();await w.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- /',tessedit_pageseg_mode:String(psm),preserve_interword_spaces:'1'});const r=await w.recognize(c);return{text:(r.data.text||'').trim(),confidence:r.data.confidence||0};}
  function good(m){return m&&m.status==='MATCH'&&(m.confidence==='MEDIUM'||m.confidence==='HIGH');}
  function resolvedFromReads(reads){
    const merged=reads.slice().sort((a,b)=>b.confidence-a.confidence).map(r=>r.text).filter(Boolean).join(' '),m=matchOCR(merged);if(good(m))return{text:merged,match:m};
    if(typeof window.lotWalkReconstructV5==='function'){const r=window.lotWalkReconstructV5(reads);if(r?.match&&good(r.match))return r;}
    return null;
  }
  async function scan(source,{render=true}={}){
    if(busy)return fallback(source,{render});busy=true;let preReads=[];
    try{
      const base=copy(source);
      // Stage 1: broad reads. This is cheap enough to try every orientation and catches both
      // printed identifiers and bright handwritten/chalk identifiers without hundreds of crops.
      for(const deg of [0,180,90,270]){
        const oriented=rotate(base,deg),variants=[{c:oriented,kind:'whole-pre'},{c:chalkify(oriented),kind:'chalk-whole'}];
        for(const v of variants)for(const psm of [7,11]){
          const r=await ocr(v.c,psm);if(r.text)preReads.push({...r,deg,kind:v.kind,psm});
          const direct=r.text?matchOCR(r.text):null;if(good(direct)){if(render){$('scanStatus').textContent=`Read: ${r.text.slice(0,140)}`;renderResult(direct);}return{text:r.text,match:direct,reads:preReads};}
        }
        const early=resolvedFromReads(preReads);if(early){if(render){$('scanStatus').textContent=`Read: ${early.text.slice(0,140)}`;renderResult(early.match);}return{...early,reads:preReads};}
      }
      // Stage 2: only the strongest line candidates. Stop as soon as either a direct or
      // corroborated identifier resolves against the current open-WO data.
      for(const deg of [0,180,90,270]){
        const oriented=rotate(base,deg),zones=lineZones(oriented);
        for(let zi=0;zi<Math.min(6,zones.length);zi++){
          const b=zones[zi],raw=crop(oriented,b,6),variants=[raw,chalkify(raw)];
          for(let vi=0;vi<variants.length;vi++)for(const psm of [7,13]){
            const r=await ocr(variants[vi],psm);if(!r.text)continue;preReads.push({...r,deg,kind:vi?'chalk-line':'line',psm,zoneRank:zi+1,x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.w),h:Math.round(b.h)});
            const direct=matchOCR(r.text);if(good(direct)){if(render){$('scanStatus').textContent=`Read: ${r.text.slice(0,140)}`;renderResult(direct);}return{text:r.text,match:direct,reads:preReads};}
            const early=resolvedFromReads(preReads);if(early){if(render){$('scanStatus').textContent=`Read: ${early.text.slice(0,140)}`;renderResult(early.match);}return{...early,reads:preReads};}
          }
        }
      }
    }finally{busy=false;}
    const fb=await fallback(source,{render:false}),all=[...preReads,...(fb.reads||[])],early=resolvedFromReads(all);const out=early?{...fb,...early,reads:all}:{...fb,reads:all};if(render){$('scanStatus').textContent=out.text?`Read: ${out.text.slice(0,140)}`:'Unknown / research';if(out.match)renderResult(out.match);}return out;
  }
  window.lotWalkScanSourceV4=scan;window.lotWalkScanSourceV2=scan;$('scanNow').onclick=()=>scan(video);const old=$('photoFile');if(old){const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>{scan(img);URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(f);});}
})();