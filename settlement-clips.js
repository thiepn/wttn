/* Editable presentation clips. No economic state, timers, purchases or selection. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WTTNSettlementClips=api;})(globalThis,function(){'use strict';
 const durations={write:4.8,check:6.4,stack:5.8,teach:7.2,listen:8.1,press:4.2,collect:2.6,deliver:3.2};
 const phases=[{name:'work',end:.56},{name:'collect',end:.62},{name:'travel',end:.78},{name:'deliver',end:.84},{name:'return',end:1}];
 function role(id,index){if(id==='teacher')return index?'listen':'teach';if(id==='workshop')return index===2?'stack':'press';if(id==='editor')return 'check';if(id==='scriptorium')return index%2?'check':'stack';return index===2?'stack':index===3?'check':'write';}
 function pose(routine,phase,reduced=false){
  const p=reduced?.22:phase,turn=p*Math.PI*2,s=Math.sin(turn),beat=Math.sin(turn*3),pose={leftArm:0,rightArm:0,head:0,lean:0,book:false,bundle:false,page:0,handY:0};
  if(routine==='write'){pose.leftArm=-.18;pose.rightArm=-.38+beat*.055;pose.head=.06;pose.lean=.035;pose.book=true;pose.page=p>.75?(p-.75)*4:0;}
  if(routine==='check'){pose.leftArm=-.24+s*.1;pose.rightArm=-.29-s*.06;pose.head=s*.06;pose.book=true;pose.page=p>.5?1:0;}
  if(routine==='stack'){pose.leftArm=-.12;pose.rightArm=-.25+s*.18;pose.handY=-Math.max(0,s)*5;pose.bundle=true;}
  if(routine==='teach'){pose.leftArm=-.15;pose.rightArm=-.4+s*.32;pose.head=s*.03;pose.book=true;}
  if(routine==='listen'){pose.leftArm=.08;pose.rightArm=.1;pose.head=s*.05;}
  if(routine==='press'){pose.leftArm=-.2;pose.rightArm=-.5+Math.max(0,s)*.38;pose.lean=Math.max(0,s)*.055;pose.handY=Math.max(0,s)*4;}
  if(routine==='collect'||routine==='deliver'){pose.leftArm=-.23;pose.rightArm=-.38+s*.17;pose.lean=Math.max(0,s)*.08;pose.bundle=true;pose.handY=-Math.max(0,s)*5;}
  return pose;
 }
 function cycle(id,index,time,reduced=false){
  const salt={scribe:0,copyist:.17,editor:.34,teacher:.51,workshop:.69,scriptorium:.87}[id]||0;
  const duration=76000+index*7300+salt*14000,p=reduced?.2:((time/duration+index*.231+salt)%1+1)%1;
  const current=phases.find(x=>p<x.end)||phases[4],prior=phases[phases.indexOf(current)-1]?.end||0;
  const workRole=role(id,index),routine=current.name==='work'?workRole:current.name==='travel'||current.name==='return'?'carry':current.name;
  return {state:current.name,progress:(p-prior)/(current.end-prior),routine,workRole,variant:(index+Math.round(salt*10))%3,phase:reduced?.22:(time/(durations[routine]*1000||780)+index*.317+salt)%1};
 }
 return {durations,phases,role,pose,cycle};
});
