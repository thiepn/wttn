/* Authored road splines and reusable clips. Coordinates are in the 1536x1024 world. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./settlement-clips'):root.WTTNSettlementClips);if(typeof module==='object'&&module.exports)module.exports=api;root.WTTNSettlementAnimation=api;})(globalThis,function(C){'use strict';
 const paths={
  scribe:[[325,438],[419,446],[489,477],[535,565],[610,620]],
  copyist:[[790,582],[782,609],[755,640],[610,620]],
  editor:[[264,748],[366,760],[439,759],[465,709],[525,652],[610,620]],
  teacher:[[1270,620],[1180,628],[1125,609],[1045,592],[955,601]],
  workshop:[[1260,875],[1244,925],[1135,936],[1025,932],[1000,899]],
  scriptorium:[[788,919],[750,959],[879,963],[969,940],[1000,899]]
 };
 const clips={write:{seconds:3.4,amplitude:.045},check:{seconds:5.2,amplitude:.032},stack:{seconds:4.5,amplitude:.05},teach:{seconds:6,amplitude:.045},press:{seconds:3.2,amplitude:.04},carry:{seconds:28,amplitude:.014}};
 function sample(path,phase){const lengths=path.slice(1).map((b,i)=>Math.hypot(b[0]-path[i][0],b[1]-path[i][1]));let distance=phase*lengths.reduce((a,b)=>a+b,0);for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const f=Math.min(1,distance/lengths[i]);return{x:path[i][0]+(path[i+1][0]-path[i][0])*f,y:path[i][1]+(path[i+1][1]-path[i][1])*f};}distance-=lengths[i];}return{x:path[0][0],y:path[0][1]};}
 // All workers remain on authored outdoor routes. Their clock belongs to the
 // settlement, never to the selected building or a render/update operation.
 function workstation(id,index){return sample(paths[id],.035+index*.115);}
 function worker(site,index,time,reduced){
  const c=C.cycle(site.id,index,time,reduced),start=.035+index*.115;
  const travel=c.state==='travel',back=c.state==='return',walking=!reduced&&(travel||back);
  const progress=travel?start+(1-start)*c.progress:back?1-(1-start)*c.progress:c.state==='deliver'?1:start;
  const p=sample(paths[site.id],progress),ahead=sample(paths[site.id],Math.max(0,Math.min(1,progress+(back?-.002:.002))));
  const length=paths[site.id].slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-paths[site.id][i][0],b[1]-paths[site.id][i][1]),0);
  return {...p,...c,scale:.84,flip:walking?ahead.x<p.x:site.id==='teacher'&&index>0,walking,carrying:travel||c.state==='collect'||c.state==='deliver',phase:walking?(progress*length/25)%1:c.phase,pose:C.pose(c.routine,c.phase,reduced)};
 }
 // Camera constraints include the new surrounding landscape. Pure functions
 // keep fit, touch zoom and resize behavior under the same bounds contract.
 function constrain(camera,bounds){const minX=camera.width-(bounds.x+bounds.w)*camera.scale,maxX=-bounds.x*camera.scale,minY=camera.height-(bounds.y+bounds.h)*camera.scale,maxY=-bounds.y*camera.scale;return{x:Math.max(minX,Math.min(maxX,camera.x)),y:Math.max(minY,Math.min(maxY,camera.y))};}
 function visibleRect(site,t,scale){return{left:t.x+(site.x-site.w*.42)*scale,right:t.x+(site.x+site.w*.42)*scale,top:t.y+(site.y-site.h*.82)*scale,bottom:t.y+(site.y+24)*scale};}
 function avoidUI(site,t,scale,safe){const r=visibleRect(site,t,scale),rw=r.right-r.left,rh=r.bottom-r.top;let dx=0,dy=0;if(rw>safe.w)dx=safe.x+safe.w/2-(r.left+r.right)/2;else if(r.left<safe.x)dx=safe.x-r.left;else if(r.right>safe.x+safe.w)dx=safe.x+safe.w-r.right;if(rh>safe.h)dy=safe.y+safe.h/2-(r.top+r.bottom)/2;else if(r.top<safe.y)dy=safe.y-r.top;else if(r.bottom>safe.y+safe.h)dy=safe.y+safe.h-r.bottom;return{x:t.x+dx,y:t.y+dy};}
 function frameSite(camera,site,safe,bounds){
  const r=visibleRect(site,{x:0,y:0},1);
  // Zoom just enough to make safe panning possible without exposing an edge.
  const required=Math.max(safe.x/(r.left-bounds.x),safe.y/(r.top-bounds.y),(camera.width-safe.x-safe.w)/(bounds.x+bounds.w-r.right),(camera.height-safe.y-safe.h)/(bounds.y+bounds.h-r.bottom));
  const scale=Math.max(camera.scale,required);
  return {...constrain({...camera,...avoidUI(site,camera,scale,safe),scale},bounds),scale};
 }
 function frameDecoration(camera,item,safe,bounds){
  const scale=Math.max(Math.max(camera.width/bounds.w,camera.height/bounds.h),Math.min(1.15,(safe.w-24)/item.w,(safe.h-60)/(item.h+30)));
  const x=safe.x+safe.w/2-item.x*scale;
  const y=safe.y+(safe.h-44-item.h*scale)/2-(item.y-item.h*.95)*scale;
  return frameSite({...camera,x,y,scale},{...item,w:(item.w+24)/.84,y:item.y+44,h:(item.h*.95+44)/.82},safe,bounds);
 }
 function cap({phone=false,low=false}={}){return low?6:phone?12:24;}
 function allocate(sites,limit){const counts=sites.map(()=>0);for(let round=0;round<4&&limit>0;round++)for(let i=0;i<sites.length&&limit>0;i++)if(sites[i].workers>round){counts[i]++;limit--;}return counts;}
 function pinchCamera(camera,start,current){const zoom=Math.max(camera.minZoom||.75,Math.min(2.4,camera.zoom*current.distance/start.distance)),scale=camera.scale*zoom/camera.zoom,worldX=(start.x-(camera.width-1536*camera.scale)/2-camera.panX)/camera.scale,worldY=(start.y-(camera.height-1024*camera.scale)/2-camera.panY)/camera.scale;return{zoom,scale,panX:current.x-(camera.width-1536*scale)/2-worldX*scale,panY:current.y-(camera.height-1024*scale)/2-worldY*scale};}
 return {paths,clips,sample,workstation,worker,cap,allocate,pinchCamera,constrain,visibleRect,avoidUI,frameSite,frameDecoration};
});
