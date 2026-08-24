"use strict";
(function(){
  // Capture the OCR text before a human corrects it, then teach the local recognizer.
  document.addEventListener("focusin",e=>{
    const t=e.target;
    if(t&&t.matches&&t.matches("#jobs .job .title"))t.dataset.urrBefore=t.value||"";
  },true);
  document.addEventListener("change",e=>{
    const t=e.target;
    if(!t||!t.matches||!t.matches("#jobs .job .title"))return;
    const before=t.dataset.urrBefore||"",after=t.value||"";
    if(window.URR_LEARN&&before&&after)window.URR_LEARN.learn(before,after);
    t.dataset.urrBefore=after;
  },true);
})();