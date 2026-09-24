/* Authored cosmetic locations. Free arrangements never enter economic state. */

(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./settlement-model'):root.WTTNSettlementModel,typeof module==='object'&&module.exports?require('./settlement-animation'):root.WTTNSettlementAnimation);if(typeof module==='object'&&module.exports)module.exports=api;root.WTTNAppearance=api;})(globalThis,function(V,R){'use strict';

 // Coordinates are measured on the 1536�1024 inspection image of the native

 // garden terrain. Ground anchors never depend on the camera or device size.

 const ground=(x,y)=>({x:x/1536*2848.476-628.012,y:y/1024*1874.038-436.01});

 const definitions=[["pergola", "Vine pergola", 270, 724, 170, 170], ["fountain", "Courtyard fountain", 1000, 810, 130, 121], ["lemon", "Lemon tree", 1200, 852, 100, 101], ["garden", "Wildflower garden", 385, 835, 130, 91], ["amphorae", "Painted amphorae", 1120, 797, 75, 61], ["cypress", "Cypress planters", 295, 839, 85, 122], ["market", "Book canopy", 514, 793, 160, 168], ["mosaic", "Mosaic terrace", 507, 890, 140, 100], ["birdbath", "Birdbath", 900, 800, 65, 105], ["readingBench", "Reading bench", 430, 750, 105, 92], ["flowers", "Flower pots", 1300, 725, 100, 94], ["handcart", "Manuscript cart", 1260, 827, 100, 77]].map(([id,name,px,py,w,h],index)=>({id,name,index,...ground(px,py),w,h,radius:w*.34}));

 const locations=Object.fromEntries(Object.entries({"upperOlive": ["Lower olive court", 620, 875], "westGarden": ["Western garden", 560, 800], "lowerStudy": ["Study garden court", 362, 841], "eastGarden": ["Eastern garden", 1390, 735], "dispatchCorner": ["Dispatch garden", 1090, 841], "westCypress": ["Western cypress court", 247, 720], "seaView": ["Seaward court", 1325, 755], "orchardEdge": ["Orchard court", 1190, 870], "lowerWalk": ["Lower garden court", 460, 833], "studyEdge": ["Study terrace edge", 340, 718], "coastAlcove": ["Coastal garden", 1110, 794]}).map(([id,[name,x,y]])=>[id,[name,ground(x,y).x,ground(x,y).y]]));

 const alternatives={pergola:['westGarden','eastGarden'],fountain:['lowerWalk','orchardEdge'],lemon:['upperOlive','lowerStudy'],garden:['westCypress','coastAlcove'],amphorae:['studyEdge','dispatchCorner'],cypress:['westGarden','seaView'],market:['lowerStudy','eastGarden'],mosaic:['lowerWalk','coastAlcove'],birdbath:['studyEdge','upperOlive'],readingBench:['westCypress','dispatchCorner'],flowers:['orchardEdge','seaView'],handcart:['eastGarden','lowerStudy']};

 const presets={oliveGarden:{name:'Olive Garden',placements:{pergola:'home',fountain:'home',lemon:'home',garden:'home',cypress:'home',flowers:'home'}},studyCourtyard:{name:'Study Courtyard',placements:{readingBench:'home',mosaic:'home',birdbath:'home',amphorae:'studyEdge',pergola:'westGarden'}},marketLane:{name:'Market Lane',placements:{market:'home',handcart:'home',amphorae:'home',flowers:'seaView',lemon:'upperOlive'}}};

 function choices(id){const d=definitions.find(x=>x.id===id);if(!d)return[];return [{id:'home',name:'Home garden terrace',x:d.x,y:d.y},...alternatives[id].map(k=>({id:k,name:locations[k][0],x:locations[k][1],y:locations[k][2]}))];}

 function placed(id,slot){const d=definitions.find(x=>x.id===id),p=choices(id).find(x=>x.id===slot);return d&&p?{...d,...p,id:d.id,slot,name:d.name,locationName:p.name}:null;}

 function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a[0]-dx*t,p.y-a[1]-dy*t);}

 // Conservative projected envelopes include roofs, tall props and their bases.

 function visualBounds(p){return {left:p.x-p.w*.5,right:p.x+p.w*.5,top:p.y-p.h*.95,bottom:p.y+p.h*.05};}

 function overlap(a,b,pad=0){return a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;}

 function clearance(p){

  const visible=visualBounds(p);

  for(const b of V.sites){if(overlap(visible,{left:b.x-b.w*.5,right:b.x+b.w*.5,top:b.y-b.h,bottom:b.y+18},5))return 'Keep the view of '+b.name+' clear.';}



  for(const b of V.sites){const x=Math.max(b.x-b.w*.26,Math.min(b.x+b.w*.26,p.x)),y=Math.max(b.y-b.h*.39,Math.min(b.y-9,p.y));if(Math.hypot((p.x-x),2*(p.y-y))<p.radius+6)return 'Too close to '+b.name+'.';}

  for(const route of Object.values(R.paths))for(let i=1;i<route.length;i++)if(segmentDistance(p,route[i-1],route[i])<p.radius*.55+12)return 'Keep the delivery route clear.';

  return '';

 }

 function validate(placements){

  if(!placements||typeof placements!=='object'||Array.isArray(placements)||Object.keys(placements).length>12)return {ok:false,reason:'Invalid decoration arrangement.'};

  const items=[];

  for(const [id,slot] of Object.entries(placements)){if(typeof slot!=='string')return {ok:false,reason:'Invalid placement identifier.'};const p=placed(id,slot);if(!p)return {ok:false,reason:'Unknown decoration or location.'};const error=clearance(p);if(error)return {ok:false,reason:error};for(const other of items)if(overlap(visualBounds(p),visualBounds(other),6))return {ok:false,reason:`This location overlaps ${other.name}.`};items.push(p);}

  return {ok:true,placements:Object.fromEntries(items.map(p=>[p.id,p.slot])),items};

 }

 function restore(placements){
  const checked=validate(placements);if(checked.ok)return checked;
  if(!placements||typeof placements!=='object'||Array.isArray(placements)||Object.keys(placements).length>12)return checked;
  if(Object.entries(placements).some(([id,slot])=>typeof slot!=='string'||!placed(id,slot)))return checked;
  return {...validate(fromLegacy(Object.keys(placements))),relocated:true};
 }
 function preview(placements,id,slot){const next={...placements,[id]:slot},result=validate(next);return {...result,unchanged:placements[id]===slot,item:placed(id,slot)};}
 function fromLegacy(ids){return Object.fromEntries((Array.isArray(ids)?ids:[]).filter(id=>definitions.some(d=>d.id===id)).map(id=>[id,'home']));}

 return {version:1,visualBounds,overlap,definitions,locations,presets,choices,placed,clearance,validate,restore,preview,fromLegacy};

});

