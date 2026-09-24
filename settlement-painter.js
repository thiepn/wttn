(function(root){'use strict';function create(ctx,A,loader,{low,calm,sites}){

 function sprite(key,col,row,x,y,w,h,alpha=1,flip=false,rotation=0){const img=loader.get(key),s=A.assets[key];if(!img?.naturalWidth)return;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);if(flip)ctx.scale(-1,1);if(rotation)ctx.rotate(rotation);const sw=img.naturalWidth/(s.columns||1),sh=img.naturalHeight/(s.rows||1),trim=(s.trimBottom||0)/512*sh,cell=row*(s.columns||1)+col,anchor=s.anchors?.[cell]||A.anchor,region=s.regions?.[cell],sx=region?region[0]/s.sourceWidth*img.naturalWidth:col*sw,sy=region?region[1]/s.sourceHeight*img.naturalHeight:row*sh,rw=region?region[2]/s.sourceWidth*img.naturalWidth:sw,rh=region?region[3]/s.sourceHeight*img.naturalHeight:sh-trim;ctx.drawImage(img,sx,sy,rw,rh,-w*anchor.x,-h*anchor.y,w,h*(1-trim/sh));ctx.restore();}

 function buildingSpec(site){if(A.assets['building-'+site.id])return {key:A.assets['building-'+site.id].stages?.[site.stage]||'building-'+site.id,col:A.assets['building-'+site.id].stages?0:site.stage%2,row:A.assets['building-'+site.id].stages?0:Math.floor(site.stage/2)};if(site.stage===2)return{key:'expanded',col:sites().indexOf(site)%3,row:Math.floor(sites().indexOf(site)/3)};return{key:site.sheet,col:site.stage===3?2:site.stage,row:site.row};}

 function buildingSize(site,b){const spec=A.assets[b.key],r=spec?.regions?.[b.row*(spec.columns||1)+b.col];if(!r)return {w:site.w,h:site.h};const w=site.w*[.84,.88,.94,1][site.stage];return {w,h:w*r[3]/r[2]};}

 function portrait(target,site){const c=target.getContext('2d');c.clearRect(0,0,target.width,target.height);const b=buildingSpec(site),img=loader.get(b.key)||loader.get(site.sheet);if(!img?.naturalWidth)return;const key=loader.get(b.key)?b.key:site.sheet,s=A.assets[key],sw=img.naturalWidth/(s.columns||3),sh=img.naturalHeight/(s.rows||3),col=key===b.key?b.col:(site.stage===3?2:Math.min(1,site.stage)),row=key===b.key?b.row:site.row,r=s.regions?.[row*(s.columns||1)+col],sx=r?r[0]/s.sourceWidth*img.naturalWidth:col*sw,sy=r?r[1]/s.sourceHeight*img.naturalHeight:row*sh,rw=r?r[2]/s.sourceWidth*img.naturalWidth:sw,rh=r?r[3]/s.sourceHeight*img.naturalHeight:sh-(s.trimBottom||0)/512*sh,f=Math.min(target.width/rw,target.height/rh);c.drawImage(img,sx,sy,rw,rh,(target.width-rw*f)/2,(target.height-rh*f)/2,rw*f,rh*f);}

 const prop=(n,x,y,size,alpha=1)=>sprite('props',n%4,Math.floor(n/4),x,y,size,size,alpha);



 function art(key,index,x,y,w,alpha=1,rotation=0){const spec=A.assets[key],r=spec?.regions?.[index];if(!spec)return;sprite(key,index%(spec.columns||1),Math.floor(index/(spec.columns||1)),x,y,w,r?w*r[3]/r[2]:w,alpha,false,rotation);}

 function decoration(p,alpha=1){

  ctx.save();ctx.globalAlpha=alpha;const shadow=ctx.createRadialGradient(p.x,p.y-2,1,p.x,p.y-2,p.w*.43);ctx.translate(p.x,p.y-2);ctx.scale(1,.24);ctx.translate(-p.x,-p.y+2);shadow.addColorStop(0,'#45352145');shadow.addColorStop(1,'#45352100');ctx.fillStyle=shadow;ctx.fillRect(p.x-p.w*.5,p.y-p.w*.5,p.w,p.w);ctx.restore();

  sprite('decorations',p.index%4,Math.floor(p.index/4),p.x,p.y,p.w,p.h,alpha);

 }

 function placementPreview(appearancePreview,scale){const p=appearancePreview.item;decoration(p,appearancePreview.unchanged?1:.65);ctx.save();ctx.strokeStyle=appearancePreview.ok?'#ffe6a6':'#a33d29';ctx.lineWidth=3/scale;ctx.setLineDash([6/scale,4/scale]);ctx.beginPath();ctx.ellipse(p.x,p.y,p.w*.32,p.w*.10,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 function equipment(method,x,y,size){art('equipment',A.methods[method],x,y,size);}

 function landscapeLayer(key){const img=loader.get(key),spec=A.assets[key];if(!img||!spec.worldRect)return;const [x,y,w,h]=spec.worldRect,b=A.bounds;ctx.drawImage(img,b.x+x*b.w,b.y+y*b.h,w*b.w,h*b.h);}

 function terrain(){const img=loader.get('terrain')||loader.get('fallback-terrain');if(!img)return;const b=A.bounds;ctx.drawImage(img,b.x,b.y,b.w,b.h);for(const key of A.assets.terrain.layerKeys||[])if(!A.assets[key].drawAfterBuildings)landscapeLayer(key);}

 function environment(now,foreground){

  if(foreground){for(const key of A.assets.terrain.layerKeys||[])if(A.assets[key].drawAfterBuildings)landscapeLayer(key);return;}

  if(low())return;

  const still=calm(),t=still?0:now;

  // Motion is local to water, sailcloth and branches; the camera and masonry stay still.

  ctx.save();ctx.strokeStyle='#e4f3ee';ctx.globalAlpha=.13;ctx.lineWidth=2;

  for(let i=0;i<7;i++){const x=610+i*62+Math.sin(t/4200+i)*8,y=162+i%3*19;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+24,y-4,x+53,y);ctx.stroke();}ctx.restore();

  art('environment-activity',0,800+(still?0:Math.sin(t/75000)*120),210,58,.85,still?0:Math.sin(t/3500)*.014);

  if(still||t%58000<14500)art('environment-activity',1,still?1130:300+(t%58000)/14500*950,-100+(still?0:Math.sin(t/2800)*14),65,.72);

  for(const [x,y,w] of [[-280,820,110],[1570,800,95],[335,1120,85]])art('environment-activity',2,x,y,w,.9,still?0:Math.sin(t/4700+x)*.016);

 }



return {sprite,buildingSpec,buildingSize,portrait,prop,art,decoration,placementPreview,equipment,terrain,environment};}

root.WTTNSettlementPainter={create};})(globalThis);

