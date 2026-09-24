(function(){'use strict';

const A=window.WTTNSettlementArt,P=window.WTTNVisualPreferences,R=window.WTTNSettlementAnimation;

function create(canvas,labels,onSelect,reduced){

 const ctx=canvas.getContext('2d',{alpha:false});let model=null,selected='scribe',hovered=null,frameId=null,dirty=true,width=0,height=0,scale=1,panX=0,panY=0,zoom=1,baseScale=1,minZoom=.75,layoutKey="",effects=[],last=0,portraitCanvas=null,portraitItem=null,workerCount=0;

 let appearancePreview=null,spots=[],appearanceKey='';const markers=document.createElement('div');markers.id='decorationMarkers';markers.setAttribute('aria-label','Decoration placement markers');canvas.parentElement.append(markers);

 const pointers=new Map();let gesture=null;const samples=[],drawTimes=[];let frames=0,totalMs=0;

 const loader=window.WTTNAssetLoader.shared(A.assets,{maxBytes:innerWidth<700?48*1024*1024:96*1024*1024});

 loader.subscribe(()=>{dirty=true;if(portraitCanvas&&portraitItem)portrait(portraitCanvas,portraitItem);start();});

 const calm=()=>P.reduced()||reduced(),low=()=>P.quality()==='low';

 const painter=window.WTTNSettlementPainter.create(ctx,A,loader,{low,calm,sites:()=>model?.sites||[]}),{sprite,buildingSpec,buildingSize,prop,art,equipment,terrain,environment}=painter;

 function ensure(key){const level=key==='terrain'&&A.assets.terrain.layerKeys?'low':low()?'low':['props','environment','worker-variants','work-props','environment-activity','milestones','campaign-keepsakes'].includes(key)?(width<700?'low':'medium'):width<700?'medium':'high';if(loader.level(key)===level)return;if(!loader.get(key))loader.load(key,'low',key==='terrain').then(()=>{if(level!=='low')loader.load(key,level,key==='terrain');});else loader.load(key,level,key==='terrain');}

 const safeArea=()=>window.WTTNSettlementLayout.safeArea(canvas,width,height);
 function setTransform(t){panX=t.x-(width-A.width*scale)/2;panY=t.y-(height-A.height*scale)/2;clamp();}

 function overview(){const safe=safeArea();setTransform({x:safe.x+safe.w/2-720*scale,y:safe.y+safe.h/2-580*scale});}

 function resize(){const r=canvas.getBoundingClientRect();const resized=r.width!==width||r.height!==height;width=r.width;height=r.height;if(!width||!height)return;loader.setBudget(width<700?48*1024*1024:96*1024*1024);if(model)loadVisible();const dpr=Math.min(low()?1.5:2,devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const safe=safeArea();baseScale=width<700?(document.body.classList.contains('world-overview')?Math.min(safe.w/1510,safe.h/1050):Math.max(.56,safe.h/800)):Math.min(safe.w/1780,safe.h/1080);minZoom=Math.max(.65,Math.max(width/A.bounds.w,height/A.bounds.h)/baseScale);zoom=Math.max(minZoom,Math.min(2.4,zoom));scale=baseScale*zoom;

  if(resized||!layoutKey){overview();if(appearancePreview||width<700&&!document.body.classList.contains('world-overview'))centerSelected();}else clamp();layoutKey=width+':'+height;dirty=true;if(model&&document.body.dataset.surface!=='settlement')draw(performance.now());start();}

 function centerSelected(){if(!appearancePreview&&width<=1050&&document.getElementById('selectionTray')?.dataset.sheet==='detail')return;const site=appearancePreview?.item||model?.sites.find(s=>s.id===selected);if(!site)return;if(!appearancePreview&&innerWidth>=600&&innerHeight<=600){const safe=safeArea();scale=Math.min(scale,safe.w/(site.w+40),safe.h/(site.h+60));}const framed=(appearancePreview?R.frameDecoration:R.frameSite)({...transform(),width,height,scale},site,safeArea(),A.bounds);scale=framed.scale;zoom=scale/baseScale;setTransform(framed);}

 function clamp(){const t=R.constrain({...transform(),width,height,scale},A.bounds);panX=t.x-(width-A.width*scale)/2;panY=t.y-(height-A.height*scale)/2;}

 function transform(){return{x:(width-A.width*scale)/2+panX,y:(height-A.height*scale)/2+panY};}

 function screen(x,y){const t=transform();return{x:t.x+x*scale,y:t.y+y*scale};}

 function portrait(target,site){portraitCanvas=target;portraitItem=site;painter.portrait(target,site);}

 function actor(p){window.WTTNWorkerPainter.draw(ctx,A,loader,p,calm());}

 function station(site,index,now){const p=R.workstation(site.id,index),role=window.WTTNSettlementClips.role(site.id,index);if(role==='listen'||index%2)return;

  const width=index===0&&site.equipment?88:68;

  if(index===0&&site.equipment)equipment(site.method,p.x+31,p.y+9,width);else prop(role==='teach'?4:role==='press'?3:0,p.x+26,p.y+9,width);

  art('work-props',role==='stack'?3:0,p.x+30,p.y-19,24);

 }

 function draw(now){if(!model||!width)return;const started=performance.now(),dpr=canvas.width/width;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#798068';ctx.fillRect(0,0,width,height);const t=transform();ctx.translate(t.x,t.y);ctx.scale(scale,scale);terrain();environment(now,false);

  const queue=[],limit=R.cap({phone:width<700,low:low()}),animate=!calm();workerCount=0;const workerAllocation=R.allocate(model.sites,limit);

  for(const site of model.sites){const actors=[];for(let i=0;i<workerAllocation[model.sites.indexOf(site)];i++){actors.push(R.worker(site,i,now,calm()));workerCount++;}queue.push({y:site.y-12,draw:()=>{

   if(site.id===selected){ctx.save();ctx.strokeStyle='#fce8a7';ctx.lineWidth=2/scale;ctx.beginPath();ctx.ellipse(site.x,site.y-8,site.w*.34,site.h*.10,0,0,Math.PI*2);ctx.stroke();ctx.restore();}

   if(site.discovered||site.id===selected||site.available){const b=buildingSpec(site);const reveal=effects.find(e=>e.type==='construction'&&e.id===site.id);const progress=!animate||!reveal?1:Math.min(1,(now-reveal.at)/650);ctx.save();if(progress<1){ctx.beginPath();ctx.rect(site.x-site.w/2,site.y-site.h*progress,site.w,site.h);ctx.clip();}if(loader.get(b.key)){const size=buildingSize(site,b);ctx.save();ctx.fillStyle='#382b2026';ctx.beginPath();ctx.ellipse(site.x,site.y-7,site.w*.29,site.w*.058,0,0,Math.PI*2);ctx.fill();ctx.restore();sprite(b.key,b.col,b.row,site.x,site.y,size.w,size.h,site.stage?1:.62);}else sprite(site.sheet,site.stage===3?2:Math.min(1,site.stage),site.row,site.x,site.y,site.w,site.h,site.stage?1:.55);ctx.restore();}

   if(site.stage){prop({indigo:8,clay:9,olive:10}[model.decorations.banner],site.x-site.w*.20,site.y-35,site.w*.17);prop({olive:12,cypress:13,flowers:14}[model.decorations.planting],site.x+site.w*.28,site.y-12,site.w*.20);}

   // Outdoor actors are depth-sorted separately from buildings.

   if(site.operating&&site.equipment)art('environment-activity',4,site.x+site.w*.13,site.y-site.h*.19,27,.9);

   if(site.operating&&!calm()&&!low())art('environment-activity',5,site.x+site.w*.13,site.y-site.h*.17,62,.13+Math.sin(now/2700+site.x)*.045);

   for(let j=0;j<site.ornaments;j++){const offsets=[[-.31,5,65],[.31,0,70],[-.4,-30,95],[.4,-45,76]][j];art('milestones',j*6+model.sites.indexOf(site),site.x+site.w*offsets[0],site.y+offsets[1],offsets[2]);}

   if(site.operating&&site.highest>=500)art('environment-activity',3,site.x-site.w*.20,site.y-35,20,1,calm()?0:Math.sin(now/3100+site.x)*.018);

   if(site.operating&&!animate){ctx.fillStyle='#fff5d8';ctx.font='bold 12px sans-serif';ctx.fillText('Working',site.x-22,site.y+13);}

  }});

  for(let i=0;i<actors.length;i++){const p=actors[i],work=R.workstation(site.id,i);queue.push({y:work.y+10,draw:()=>station(site,i,now)});queue.push({y:p.y,draw:()=>actor(p,now)});}

  }

  if(model.globalEquipment.shared)queue.push({y:613,draw:()=>equipment('shared',945,613,110)});

  if(model.globalEquipment.translation)queue.push({y:615,draw:()=>equipment('translationPrep',1050,615,110)});

  for(const [id,n,x,y,size] of [['manuscript',5,580,630,115],['reference',6,1050,770,145],['teaching',7,1335,638,130]])if(model.commissions[id])queue.push({y,draw:()=>{const index=['manuscript','reference','teaching'].indexOf(id);if(loader.get('commissions')){const spec=A.assets.commissions,r=spec.regions?.[index];sprite('commissions',index,0,x,y,size,r?size*r[3]/r[2]:size);}else prop(n,x,y,size);}});

  if(model.sites.some(s=>s.discovered))queue.push({y:710,draw:()=>prop({planters:11,bench:7,fountain:6}[model.decorations.courtyard],480,710,110)});

  for(const p of window.WTTNAppearance.validate(P.get().placements).items||[])if(p.id!==appearancePreview?.item?.id)queue.push({y:p.y,draw:()=>painter.decoration(p)});

  if(appearancePreview?.item){const p=appearancePreview.item;queue.push({y:p.y+1,draw:()=>{painter.placementPreview(appearancePreview,scale)}});}

  for(const [i,earned,x,y,w] of [[0,model.achievements.translation,1100,1140,115],[1,model.achievements.network,410,1120,68],[2,model.achievements.field,1450,1090,95],[3,model.achievements.legacy,920,1175,115],[4,model.achievements.mastery,50,1130,90],[5,model.achievements.campaign,740,1130,225]])if(earned)queue.push({y,draw:()=>art('campaign-keepsakes',i,x,y,w)});

  queue.sort((a,b)=>a.y-b.y).forEach(item=>item.draw());environment(now,true);

  effects=effects.filter(e=>now-e.at<1700);for(const e of effects){if(!calm()&&e.type==='departure'){const phase=(now-e.at)/1700;art('campaign-keepsakes',0,700+phase*280,1060+phase*80,110,1-phase);continue;}if(!calm()&&e.type==='commission'){const pos={manuscript:[580,630],reference:[1050,770],teaching:[1335,638]}[e.id];if(pos){art('environment-activity',5,pos[0],pos[1],140,.35*(1-(now-e.at)/1700));}continue;}const site=model.sites.find(s=>s.id===e.id);if(!site||calm())continue;const age=(now-e.at)/1700;ctx.save();ctx.globalAlpha=1-age;ctx.fillStyle='#fff8d8';ctx.font='600 18px Alegreya,serif';ctx.textAlign='center';ctx.shadowColor='#263c2b';ctx.shadowBlur=5;ctx.fillText(e.type==='construction'?'Established':e.type==='delivery'?'+'+e.amount+' at work':e.type==='equipment'?'Equipped':'New milestone',site.x,site.y-site.h*.65-age*25);ctx.restore();}

  const nextSite=model.sites.find(s=>s.available&&!s.operating&&s.id!==selected)?.id;

  const safe=safeArea();for(const site of model.sites){const label=labels.querySelector('[data-site="'+site.id+'"]');if(!label)continue;const p=screen(site.x,site.y+36);label.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,0)`;const inside=p.x>safe.x&&p.x<safe.x+safe.w&&p.y>safe.y-20&&p.y+38<safe.y+safe.h;label.dataset.visible=String(inside&&(P.get().labels==='all'||document.body.classList.contains('world-overview')||site.id===selected||site.id===hovered||site.id===nextSite));}

  for(const choice of spots){const el=markers.querySelector('[data-location="'+choice.id+'"]');if(!el)continue;const p=screen(choice.x,choice.y+28);el.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,0)`;const visible=p.x>safe.x&&p.x<safe.x+safe.w&&p.y>safe.y&&p.y+44<safe.y+safe.h;el.hidden=!visible;}

  const spent=performance.now()-started;totalMs+=spent;drawTimes.push(spent);if(drawTimes.length>240)drawTimes.shift();frames++;if(last){samples.push(now-last);if(samples.length>240)samples.shift();}last=now;dirty=false;

 }

 function loop(now){frameId=null;if(document.hidden||document.body.dataset.surface!=='settlement'){last=0;return;}if(dirty||!calm())draw(now);if(!calm())frameId=requestAnimationFrame(loop);}

 function start(){if(frameId===null&&!document.hidden)frameId=requestAnimationFrame(loop);}

 function hit(e){if(!model)return null;const r=canvas.getBoundingClientRect(),t=transform(),x=(e.clientX-r.left-t.x)/scale,y=(e.clientY-r.top-t.y)/scale;return[...model.sites].sort((a,b)=>b.y-a.y).find(s=>Math.abs(x-s.x)<s.w*.34&&y<s.y+12&&y>s.y-s.h*.72);}

 function pinch(){const [a,b]=[...pointers.values()];return{distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}

 canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);gesture={x:e.clientX,y:e.clientY,panX,panY,moved:false,zoom,scale,width,height,minZoom};if(pointers.size===2)gesture={...gesture,pinch:pinch(),moved:true};});

 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)){const next=hit(e)?.id;if(next!==hovered){hovered=next;dirty=true;start();}return;}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!gesture)return;if(pointers.size===2&&gesture.pinch){const p=pinch();const camera=R.pinchCamera(gesture,gesture.pinch,p);zoom=camera.zoom;scale=camera.scale;panX=camera.panX;panY=camera.panY;}else{const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.abs(dx)+Math.abs(dy)>6)gesture.moved=true;panX=gesture.panX+dx;panY=gesture.panY+dy;}clamp();dirty=true;start();});

 canvas.addEventListener('pointerup',e=>{if(gesture&&!gesture.moved){const site=hit(e);if(site)onSelect(site.id);}pointers.delete(e.pointerId);gesture=null;});canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;});

 canvas.addEventListener('pointerleave',()=>{hovered=null;dirty=true;start();});

 document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){cancelAnimationFrame(frameId);frameId=null;}else{dirty=true;start();}});

 new ResizeObserver(resize).observe(canvas);new ResizeObserver(()=>{if(model){centerSelected();dirty=true;start();}}).observe(document.querySelector('.chapter-ribbon'));new MutationObserver(()=>{last=0;dirty=true;start();}).observe(document.body,{attributes:true,attributeFilter:['data-surface']});P.subscribe(()=>{if(model)loadVisible();resize();});

 function loadVisible(){if(document.body.dataset.surface!=='settlement')return;loader.prioritize(['terrain',...(A.assets.terrain.layerKeys||[]),...model.sites.filter(s=>s.discovered||s.available||s.id===selected).map(s=>buildingSpec(s).key)]);ensure('terrain');if(A.assets.commissions&&Object.values(model.commissions).some(Boolean))ensure('commissions');if(A.assets['fallback-terrain'])loader.load('fallback-terrain','low');if(!low())for(const key of A.assets.terrain.layerKeys||[])ensure(key);ensure('props');if(P.get().decorations.length||appearancePreview)ensure('decorations');loader.load('workers','low');ensure('environment');ensure('environment-activity');ensure('work-props');if(model.sites.some(s=>s.ornaments))ensure('milestones');if(Object.values(model.achievements).some(Boolean))ensure('campaign-keepsakes');if(A.assets['worker-variants']){loader.load('rig','low');ensure('worker-variants');}else if(A.assets.rig)ensure('rig');for(const s of model.sites)if(s.discovered||s.available||s.id===selected){if(A.assets['building-'+s.id]){loader.load(s.sheet,'low');ensure(buildingSpec(s).key);}else ensure(s.sheet);}if(model.sites.some(s=>s.stage===2&&!A.assets['building-'+s.id]))ensure('expanded');if(model.sites.some(s=>s.equipment)||model.globalEquipment.shared||model.globalEquipment.translation)ensure('equipment');}

 return{portrait,previewAppearance(preview,choices,pick){appearancePreview=preview;spots=choices;const key=preview?JSON.stringify([preview.item?.id,preview.item?.slot,preview.ok,P.get().placements]):'';if(key===appearanceKey)return;appearanceKey=key;const markerSignature=choices.map(p=>p.id).join('|');if(markers.dataset.signature!==markerSignature){markers.dataset.signature=markerSignature;markers.replaceChildren(...choices.map((choice,i)=>{const b=document.createElement('button');b.dataset.location=choice.id;b.textContent=String(i+1);b.setAttribute('aria-label','Preview '+choice.name);b.setAttribute('aria-pressed',String(preview?.item?.slot===choice.id));b.onclick=()=>pick(choice.id);return b;}));}for(const b of markers.children)b.setAttribute('aria-pressed',String(preview?.item?.slot===b.dataset.location));if(preview?.item){ensure('decorations');centerSelected();}dirty=true;start();},update(next,events){const first=!model;model=next;loadVisible();if(first&&width<700)centerSelected();for(const e of events)if(!calm()){if(e.type==='milestone'&&events.some(x=>x.id===e.id&&x.type==='construction'))continue;effects=effects.filter(x=>x.id!==e.id);effects.push({...e,at:performance.now()});}effects=effects.slice(-12);dirty=true;start();},select(id,focus=true){selected=id;if(focus)document.body.classList.remove('world-overview');const b=canvas.getBoundingClientRect();if(b.width!==width||b.height!==height)resize();if(model)loadVisible();if(focus)centerSelected();dirty=true;start();},zoom(value){const old=scale,t=transform(),safe=safeArea(),cx=safe.x+safe.w/2,cy=safe.y+safe.h/2;zoom=Math.max(minZoom,Math.min(2.4,zoom+value));scale=baseScale*zoom;setTransform({x:cx-(cx-t.x)/old*scale,y:cy-(cy-t.y)/old*scale});centerSelected();dirty=true;start();},fit(){document.body.classList.add('world-overview');zoom=1;resize();overview();dirty=true;start();},frameSelection(){centerSelected();dirty=true;start();},stats(){const sorted=[...drawTimes].sort((a,b)=>a-b);return{frames,meanDrawMs:frames?totalMs/frames:0,p95DrawMs:sorted[Math.floor(sorted.length*.95)]||0,fps:samples.length?1000/(samples.reduce((a,b)=>a+b,0)/samples.length):0,workers:workerCount,quality:P.quality(),camera:{zoom,panX,panY,scale,minZoom,safe:safeArea(),transform:transform()},workerPositions:model?model.sites.flatMap((s,i)=>Array.from({length:R.allocate(model.sites,R.cap({phone:width<700,low:low()}))[i]},(_,j)=>({site:s.id,...R.worker(s,j,performance.now(),calm())}))):[],...loader.stats()};}};

}

window.WTTNSettlementScene={create};

})();

