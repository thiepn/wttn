/* The scene camera uses the same occupied areas as the responsive HTML shell. */
(function(root){'use strict';
 function safeArea(canvas,width,height){
  const chapter=document.querySelector('.chapter-ribbon')?.getBoundingClientRect(),tray=document.getElementById('selectionTray')?.getBoundingClientRect(),nav=document.querySelector('.world-nav')?.getBoundingClientRect(),canvasBox=canvas.getBoundingClientRect();
  if(width<700&&document.getElementById('selectionTray')?.dataset.detail==='decorations'){const y=innerWidth>=600&&innerHeight<=600?90:8;return{x:12,y,w:width-24,h:Math.max(32,height-2*y)};}
  if(document.body.classList.contains('world-overview')&&width<700)return{x:8,y:8,w:Math.max(180,width-16),h:Math.max(32,height-16)};
  const side=innerWidth>1050||(innerWidth>=600&&innerHeight<=600),x=width<700&&!side?49:20,y=Math.max(innerWidth>=600&&innerHeight<=600?140:90,chapter?.height?chapter.bottom+16:90)-canvasBox.top;
  let right=width-(width<700&&!side?49:20),bottom=Math.min(height-25,(nav?.top||height-72)-18-canvasBox.top);
  if(tray?.width&&document.body.dataset.surface==='settlement'){if(side)right=Math.min(right,tray.left-20-canvasBox.left);else bottom=Math.min(bottom,tray.top-25-canvasBox.top);}
  return{x,y,w:Math.max(120,right-x),h:Math.max(60,bottom-y)};
 }
 root.WTTNSettlementLayout={safeArea};
})(globalThis);
