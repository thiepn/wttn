(function(root){'use strict';
function draw(ctx,A,loader,p,still){
 function art(key,index,x,y,w,alpha=1,rotation=0){const spec=A.assets[key],r=spec?.regions?.[index],im=loader.get(key);if(!r||!im)return;const f=im.naturalWidth/spec.sourceWidth,h=w*r[3]/r[2];ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(im,r[0]*f,r[1]*f,r[2]*f,r[3]*f,-w/2,-h,w,h);ctx.restore();}
  const rig=loader.get('worker-variants'),pose=p.pose||{},wave=still?0:Math.sin(p.phase*Math.PI*2);
  ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#39291f38';ctx.beginPath();ctx.ellipse(0,1,14,4,0,0,Math.PI*2);ctx.fill();ctx.scale(p.scale,p.scale);if(p.flip)ctx.scale(-1,1);
  if(rig){const spec=A.assets['worker-variants'];
   function part(n,x,y,w,h,angle=0,pivotX=0,pivotY=0){const b=spec.regions[p.variant*6+n],f=rig.naturalWidth/spec.sourceWidth;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(rig,b[0]*f,b[1]*f,b[2]*f,b[3]*f,-pivotX,-pivotY,w,h);ctx.restore();}
   part(3,-7,-27,12,28,p.walking?wave*.22:0,3,0);part(4,5,-27,13,28,p.walking?-wave*.22:0,3,0);
   ctx.rotate(pose.lean||0);part(1,-10,-54,22,25,p.walking?-wave*.10:pose.leftArm||0,3,3);
   part(0,-15,-70,30,45,pose.head||0,0,0);
   if(pose.book){art('work-props',0,19,-32,29);if(pose.page>0)art('work-props',1,18+pose.page*5,-34,19,.8,pose.page*.45);}
   part(2,7,-52,26,24,p.walking?wave*.10:pose.rightArm||0,3,3);
   if(p.carrying||pose.bundle)part(5,9,-32+(pose.handY||0),24,16);
   if(p.routine==='write'){ctx.strokeStyle='#402d20';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(29,-38);ctx.lineTo(34,-48+wave);ctx.stroke();}
   if(p.routine==='press')art('work-props',5,25,-28+(pose.handY||0),25,1,(pose.rightArm||0)*.25);
  }else {ctx.fillStyle='#a56a41';ctx.fillRect(-7,-40,14,28);ctx.fillStyle='#d6ae7e';ctx.beginPath();ctx.arc(0,-45,6,0,Math.PI*2);ctx.fill();}
  ctx.restore();

}
root.WTTNWorkerPainter={draw};
})(globalThis);
