(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./game-core.js'):root.WTTNCore);if(typeof module==='object'&&module.exports)module.exports=api;root.WTTNWorkshopModel=api;})(globalThis,function(G){
  'use strict';
  function purchase(state,def,amount){
    const preview={...state,producers:{...state.producers},records:{...state.records}};
    const before=G.pageProduction(state), parts={};G.pageProduction(state,parts);
    const result=G.buyProducer(preview,def.id,amount==='max'?'max':Number(amount));
    const nextCost=G.producerCost(def,state.producers[def.id],state);
    const next={...state,producers:{...state.producers,[def.id]:state.producers[def.id]+1}};
    return {quantity:result.bought,cost:result.spent,nextCost,contribution:parts[def.id]||G.bn(0),gain:G.pageProduction(result.bought?preview:next).sub(before),milestone:G.milestoneDescription(state.producers[def.id]),eta:before.isZero?Infinity:nextCost.sub(state.pages).div(before).toNumber()};
  }
  function visibleProducers(state){
    if(state.translations||state.networks||state.legacies)return G.PRODUCERS;
    const highest=G.PRODUCERS.reduce((n,p,i)=>state.producers[p.id]>0||state.peakPages.gte(G.producerCost(p,0,state))?i:n,0);
    return G.PRODUCERS.slice(0,Math.min(G.PRODUCERS.length,highest+2));
  }
  function visibleMethods(state){
    if(state.translations)return G.PAGE_UPGRADES;
    const visible=G.PAGE_UPGRADES.filter(d=>state.pageUpgrades[d.id]||state.peakPages.gte(G.bn(d.cost).div(5))||(d.target&&state.producers[d.target]>0));
    return visible.length?visible:[G.PAGE_UPGRADES[0]];
  }
  const scenes=[['copying','A page, a beginning','The first desk is ready. Build a careful, lasting work.'],['workshop','A place for patient work','The desk is organized. Plan the next purchases before you leave.'],['translation','Understanding across languages','Compare, learn, and carry good methods into the next run.'],['network','A work that travels','Books leave the workshop through dependable partnerships.'],['field','Learning in every context','Listen, adapt, and choose an approach for each Field.'],['legacy','Good work, carried forward','The room holds the experience of generations of work.']];
  function scene(state){const i=state.legacies||state.campaign.complete?5:state.field.active||state.field.index?4:state.networks?3:state.translations?2:state.pageUpgrades.desk||state.projects.manuscript?1:0;return {index:i,id:scenes[i][0],title:scenes[i][1],description:scenes[i][2],active:Object.values(state.producers).some(n=>n>0),equipment:Object.values(state.pageUpgrades).filter(Boolean).length,projects:Object.values(state.projects).filter(Boolean).length};}
  function resetPreview(state,layer){
    const copy=G.reviveState(JSON.parse(JSON.stringify(state)));
    const fn={translation:G.completeTranslation,network:G.completeNetwork,legacy:G.completeLegacy}[layer];
    const result=fn(copy);if(!result.ok)return null;
    const lost={translation:'Pages, producers, Methods and Projects rebuild from retained starting conditions.',network:'Pages and the Translation economy rebuild; Network development remains.',legacy:'Lower economies, Network development and current Field progress rebuild; lifetime achievements remain.'}[layer];
    return {gain:result.gain,lost:lost+' Discovered architecture, visual commissions, decorations and reading bookmarks remain.',pages:copy.pages,pps:G.pageProduction(copy),producers:G.PRODUCERS.filter(d=>copy.producers[d.id]).map(d=>(typeof module==='object'&&module.exports?require('./presentation-language'):globalThis.WTTNLanguage).units(d.id,copy.producers[d.id])).join(', ')||'No producers yet',ti:copy.ti,queue:copy.purchaseQueue.orders.length,automation:copy.automation.full?'Full production':copy.automation.basic?'Basic purchasing':'Manual purchasing',methods:G.PAGE_UPGRADES.filter(d=>copy.pageUpgrades[d.id]).map(d=>d.name).join(', ')||'None',unlocks:{translation:'Translation Insight development and specialization progress',network:'Distribution allocations and permanent base automation',legacy:'Traditions and permanent Legacy milestones'}[layer]};
  }
  return {purchase,visibleProducers,visibleMethods,scene,resetPreview};
});
