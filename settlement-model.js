(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./game-core'):root.WTTNCore,typeof module==='object'&&module.exports?require('./workshop-model'):root.WTTNWorkshopModel);if(typeof module==='object'&&module.exports)module.exports=api;root.WTTNSettlementModel=api;})(globalThis,function(G,W){
'use strict';
const sites=[
{id:'scribe',name:'Scribe’s House',x:315,y:422,w:430,h:315,sheet:'buildings-a',row:0,method:'desk'},
{id:'copyist',name:'Copying Hall',x:760,y:568,w:510,h:450,sheet:'buildings-a',row:1,method:'copying'},
{id:'editor',name:'Study House',x:240,y:735,w:400,h:360,sheet:'buildings-a',row:2,method:'editorial'},
{id:'teacher',name:'Teaching Courtyard',x:1245,y:606,w:450,h:360,sheet:'buildings-b',row:0,method:'teaching'},
{id:'workshop',name:'Production Workshop',x:1250,y:856,w:470,h:415,sheet:'buildings-b',row:1,method:'workshopCoord'},
{id:'scriptorium',name:'Grand Library',x:770,y:898,w:460,h:435,sheet:'buildings-b',row:2,method:'reference'}
];
function chapter(s){
 const ready=(title,text,action,screen)=>({title,text,action,screen,progress:1});
 if(s.campaign.complete)return ready('A place that remembers','Your completed work remains. Explore the settlement, its arrangements and the Codex.','Read the collected passages','scripture');
 if(G.finalSequenceAvailable(s))return ready('To Every Nation','Your existing campaign completion is ready. Review the final chapter.','Review the final chapter','legacy');
 if(G.fieldReward(s).gte(1))return ready('Bring the experience home','This Field’s requirements are complete. Review the earned experience before returning.','Review Field return','fields');
 if(G.legacyGain(s).gte(1))return ready('Good work, carried forward','Review the experience retained by the next generation.','Review Legacy','legacy');
 if(G.networkGain(s).gte(1))return ready('Connect the work','Review your distribution gain and the starting position of the next cycle.','Review connections','network');
 if(G.translationGain(s).gte(1))return ready('Ready to send your work onward','Preview your Translation: what travels with you, and what rebuilds.','Review departure','translation');
 if(!s.producers.scribe)return {title:'A place to begin',text:'Establish or reopen the Scribe’s House to begin copying.',action:'Open the Scribe’s House',building:'scribe',progress:0};
 const missing=G.PAGE_UPGRADES.find(m=>m.target&&!s.pageUpgrades[m.id]&&s.producers[m.target]>0);
 if(missing)return {title:'Make room for good work',text:missing.name+' costs '+G.bn(missing.cost).format(2)+' Pages. Equip it at the '+sites.find(x=>x.id===missing.target).name+'.',action:'Review '+missing.name,building:missing.target,detail:'methods',progress:Math.min(1,s.pages.div(missing.cost).toNumber())};
 if(G.specializationUnlocked(s)&&!s.specialization)return {title:'Choose your working approach',text:'Patient study, efficient publishing, or teaching through milestones.',action:'Choose an approach',detail:'approaches',progress:1};
 const commission=G.PROJECTS.find(p=>!s.projects[p.id]&&(G.projectStatus(s,p.id).available||s.peakPages.gte(G.projectThreshold(s,p.id).div(5))));
 if(commission){const status=G.projectStatus(s,commission.id);return {title:status.available?'A commission is ready':'Prepare '+commission.name,text:status.available?'Review the investment and the effect before completing the work.':status.reasons.join(' · '),action:'Review commission',screen:'projects',progress:Math.min(1,s.peakPages.div(G.projectThreshold(s,commission.id)).toNumber())};}
 if(G.fieldUnlocked(s)&&!s.field.active&&!s.campaign.complete)return ready('A new place to serve','Read the local constraints and what you will rebuild before entering a Field.','Explore Fields','fields');
 const candidates=W.visibleProducers(s).filter(p=>G.nextMilestone(s.producers[p.id])!==null).map(p=>({def:p,cost:G.producerCost(p,s.producers[p.id],s)})).sort((a,b)=>a.cost.log10-b.cost.log10);
 if(candidates.length){const {def,cost}=candidates[0],site=sites.find(x=>x.id===def.id),n=G.nextMilestone(s.producers[def.id]);return {title:s.producers[def.id]?'Develop '+site.name:'The next building opportunity',text:s.producers[def.id]?`Next hire: ${cost.format(2)} Pages. Work toward ${n} for the next milestone.`:`Establish ${site.name} for ${cost.format(2)} Pages.`,action:'Review '+site.name,building:def.id,progress:Math.min(1,s.pages.div(cost).toNumber())};}
 return {title:'Prepare your next visit',text:'Review finite purchasing orders and leave a useful plan for the settlement.',action:'Plan purchases',detail:'plans',progress:0};
}
function derive(s){
 const visible=W.visibleProducers(s).map(p=>p.id),memory=s.settlement||{};let parts={};G.pageProduction(s,parts);
 return {achievements:{translation:s.translations>0,network:s.networks>0,field:s.field.index>0,legacy:s.legacies>0,mastery:s.field.matureClears>0,campaign:!!s.campaign.complete},sites:sites.map(site=>{const owned=s.producers[site.id],highest=Math.max(owned,memory.buildings?.[site.id]||0),stage=highest>=25?3:highest>=10?2:highest>0?1:0;return {...site,owned,highest,stage,ornaments:[50,100,250,500].filter(n=>highest>=n).length,discovered:highest>0,available:visible.includes(site.id),operating:owned>0,workers:owned?(owned>=25?4:owned>=10?3:owned>=4?2:1):0,equipment:!!s.pageUpgrades[site.method],historicalEquipment:!!memory.methods?.[site.method],contribution:parts[site.id]||G.bn(0)};}),chapter:chapter(s),decorations:memory.decorations||{banner:'indigo',planting:'olive',courtyard:'planters'},commissions:memory.commissions||{},currentProjects:s.projects,globalEquipment:{shared:!!s.pageUpgrades.shared,translation:!!s.pageUpgrades.translationPrep},queueCount:s.purchaseQueue.orders.length,queueStatus:G.purchaseQueueStatus(s),pps:G.pageProduction(s),fieldActive:s.field.active,fieldId:s.field.activeId,fieldClears:s.field.index+s.field.matureClears,epoch:s.translations+s.networks+s.legacies};
}
function events(previous,next){if(!previous)return[];const result=[];for(const site of next.sites){const old=previous.sites.find(x=>x.id===site.id);if(site.owned>old.owned)result.push({type:old.owned?'delivery':'construction',id:site.id,amount:site.owned-old.owned});if(site.stage>old.stage)result.push({type:'milestone',id:site.id});if(site.equipment&&!old.equipment)result.push({type:'equipment',id:site.id});}for(const key of ['shared','translation'])if(next.globalEquipment[key]&&!previous.globalEquipment[key])result.push({type:'equipment',id:key==='shared'?'copyist':'scriptorium',method:key});for(const id of Object.keys(next.commissions))if(next.commissions[id]&&!previous.commissions[id])result.push({type:'commission',id});if(next.epoch>previous.epoch||(!previous.fieldActive&&next.fieldActive))result.push({type:'departure'});if(previous.fieldActive&&!next.fieldActive&&next.fieldClears>previous.fieldClears)result.push({type:'return'});if(next.achievements.campaign&&!previous.achievements.campaign)result.push({type:'finale'});return result.slice(-12);}
function recapMilestones(previous,next){return next.sites.flatMap(site=>{const old=previous.sites.find(x=>x.id===site.id);const levels=[1,10,25,50,100,250,500].filter(n=>site.highest>=n&&old.highest<n);return levels.length?[site.name+' · '+levels.join(', ')]:[];});}
return {sites,derive,chapter,events,recapMilestones};
});
