(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.WTTNLegacyDepth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PROFILES={
    translation:{title:'Long-cycle language work',strength:'Faster mature Translation cadence',note:'Preparation and Translation specialization effects remain the center of this Legacy era.'},
    teaching:{title:'Structured formation',strength:'Stronger milestones and Project structure',note:'Project completion and producer milestones are the main recovery tools.'},
    distribution:{title:'Route stewardship',strength:'Stronger allocation synergies and retained Infrastructure',note:'Network configuration carries more of the recovery burden.'},
    pioneer:{title:'Field-first continuity',strength:'Lower Field thresholds and easier Field entry',note:'Reach the next context sooner, but do not neglect permanent rewards from optional routes.'}
  };
  const PATTERN_STRATEGY={
    stewardship:{pressure:'Recovery discipline',approach:'Favor Local + Regional early, then transition toward steady TI once the first Network is secure.'},
    translation:{pressure:'Longer Translation cycles',approach:'International capacity matters more here. Plan three deliberate Translations instead of reset-spamming.'},
    distribution:{pressure:'Balanced routing',approach:'Two valid Networks are required. Use Regional/Digital synergy and respect the tighter allocation cap.'},
    integration:{pressure:'Whole-system coordination',approach:'All Projects, repeated Translations, and two valid Networks must mature together.'}
  };
  function traditionProfile(state,G,id=state?.tradition){
    if(!id) return {id:null,title:'No Tradition selected',strength:'Choose a Tradition after the first Legacy',note:'Traditions shape how the same endgame systems are approached.'};
    return {id,...(PROFILES[id]||{title:G?.traditionDef?.(id)?.name||id,strength:'Specialized Legacy path',note:''})};
  }
  function nextMilestone(state,G){
    const current=Number(state?.lifetimeLegacy?.toNumber?.()||0);
    const next=(G?.LEGACY_MILESTONES||[]).find(m=>m.amount>current+1e-9)||null;
    return next?{...next,remaining:Math.max(0,next.amount-current),progress:Math.min(1,current/next.amount)}:null;
  }
  function matureCycle(state,G){
    const status=G?.matureCycleStatus?.(state);
    if(!status) return null;
    const field=status.next;
    const strategy=PATTERN_STRATEGY[field?.patternId]||{pressure:'Mature recovery',approach:'Balance recovery, Translation, and Network timing.'};
    return {...status,field,strategy,remainingInSet:(G.MATURE_FIELD_PATTERNS?.length||4)-status.completedInCycle};
  }
  function legacyPlan(state,G){
    const ready=G.legacyReady(state);
    const gain=G.legacyGain(state);
    const readiness=G.legacyReadiness(state);
    const next=nextMilestone(state,G);
    const profile=traditionProfile(state,G);
    const mature=matureCycle(state,G);
    let action='Build Field Experience';
    let reason=`${state.feThisLegacy.format(0)} / ${G.LEGACY_UNLOCK_FE.format(0)} FE this era.`;
    if(ready && readiness.status==='mature'){ action=`Establish Legacy for +${gain.format(0)} L`; reason='This era receives the full repeat-Legacy reward formula.'; }
    else if(ready){ action='Consider extending this Legacy era'; reason=`Current readiness is ${Math.round((readiness.factor||0)*100)}%; waiting improves the permanent return.`; }
    return {ready,gain,readiness,next,profile,mature,action,reason};
  }
  function campaignPlan(state,G){
    const legacyTarget=Number(G.CAMPAIGN_LEGACY_TARGET?.toNumber?.()||100);
    const lifetime=Number(state.lifetimeLegacy?.toNumber?.()||0);
    const matureNeeded=G.MATURE_FIELD_PATTERNS?.length||4;
    const mature=Number(state.field?.matureClears||0);
    return {
      legacy:{current:lifetime,target:legacyTarget,met:lifetime>=legacyTarget},
      fields:{tier1:state.campaign?.tier1||0,tier2:state.campaign?.tier2||0,tier3:state.campaign?.tier3||0},
      mature:{current:Math.min(mature,matureNeeded),target:matureNeeded,met:mature>=matureNeeded},
      ready:G.finalSequenceAvailable(state)
    };
  }
  return {traditionProfile,nextMilestone,matureCycle,legacyPlan,campaignPlan,PATTERN_STRATEGY};
});
