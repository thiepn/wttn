(function(){'use strict';

const G=window.WTTNCore,V=window.WTTNSettlementModel,W=window.WTTNWorkshopModel,patch=window.WTTNView.patch,$=id=>document.getElementById(id),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let api,scene,model,selected='scribe',amount='1',detail='',activePanel='',focusOrigin=null,lastDetailKey='',decorSelected='pergola',decorSlot='home';

const L=window.WTTNLanguage,P=window.WTTNVisualPreferences;

const decorNames={pergola:'Vine pergola',fountain:'Courtyard fountain',lemon:'Lemon tree',garden:'Wildflower garden',amphorae:'Painted amphorae',cypress:'Cypress planters',market:'Book canopy',mosaic:'Mosaic terrace',birdbath:'Birdbath',readingBench:'Reading bench',flowers:'Flower pots',handcart:'Manuscript cart'};

const money=n=>api.format(n),changed=()=>{api.render();api.save();};

function choose(id,focus=false){if(!V.sites.some(s=>s.id===id))return;selected=id;close();scene.select(id);update(api.getState());if(focus)$('hireWorker').focus({preventScroll:true});}

function open(id){detail='';focusOrigin=document.activeElement;api.open(id);screen(id);queueMicrotask(()=>$('panelHeading').focus({preventScroll:true}));}

function close(){activePanel='';document.body.dataset.surface='settlement';$('screenPanel').hidden=true;for(const b of document.querySelectorAll('[data-destination]'))b.setAttribute('aria-current',b.dataset.destination==='settlement'?'page':'false');scene?.select(selected,false);}

function screen(id){if(!api)return;if(id==='work'&&!activePanel)return;if(activePanel!==id){requestAnimationFrame(()=>{if(activePanel===id){$('mainContent').scrollTop=0;$('journeyMap').scrollTop=0;}});}activePanel=id;document.body.dataset.panel=id;$('screenPanel').hidden=false;document.body.dataset.surface=id==='scripture'?'codex':['projects','work','system','stats'].includes(id)?'menu':'journey';const names={work:'Building ledger',projects:'Settlement commissions',translation:'Send your work onward',insight:'Translation practice',network:'Distribution connections',fields:'Field destinations',legacy:'A lasting legacy',scripture:'Scripture Codex',system:'Your game',stats:'Campaign record'};$('panelHeading').textContent=names[id]||'Journey';for(const b of document.querySelectorAll('[data-destination]'))b.setAttribute('aria-current',b.dataset.destination===document.body.dataset.surface?'page':'false');}

function dispatch(type,id,value){const s=api.getState();let ok=false;

 if(type==='hire'){s.settlement.onboarding.welcome=true;const result=G.buyProducer(s,selected,amount==='max'?'max':Number(amount));ok=result.bought>0;if(ok)api.toast(`${L.units(selected,result.bought)} added · ${money(G.pageProduction(s))} Pages/sec total`);}

 if(type==='method')ok=G.buyPageUpgrade(s,id);

 if(type==='approach')ok=G.setSpecialization(s,id,{forNextRun:!!s.specialization});

 if(type==='queue')ok=G.enqueuePurchase(s,{type:'producer',id:selected,target:Number(value)});

 if(type==='method-order')ok=G.enqueuePurchase(s,{type:'method',id});

 if(type==='queue-target')ok=G.setPurchaseOrderTarget(s,Number(id),Number(value));

 if(type==='queue-edit')ok=G.editPurchaseQueue(s,Number(id),value);

 if(type==='decoration')ok=G.setSettlementDecoration(s,id,value);

 if(ok){api.sound(type==='hire'?'purchase':type==='method'?'method':'select');changed();}else api.toast(type==='queue'?'Plan unavailable: unlock Organized Desk, then add up to six valid orders.':'This action is not available yet.');return ok;

}

function extra(s){

 if(detail==='methods'){const site=V.sites.find(x=>x.id===selected);return `<h3>Equip this building</h3><div class="method-options">${G.PAGE_UPGRADES.filter(m=>m.id===site.method||m.globalMult).map(m=>`<article><img class="equipment-thumb" src="${window.WTTNEquipmentImages[m.id]}" alt=""><div><strong>${m.name}</strong><p>${esc(window.WTTNPresentationDisclosure.methodDescription(m))}${m.id==='desk'?' Unlocks six planned orders and your working approach.':''}</p></div><div class="method-actions"><button data-world-method="${m.id}" ${s.pageUpgrades[m.id]||!G.canAfford(s.pages,G.bn(m.cost))?'disabled':''}>${s.pageUpgrades[m.id]?'Equipped':'Equip · '+money(G.bn(m.cost))+' Pages'}</button>${!s.pageUpgrades[m.id]&&G.queueUnlocked(s)?`<button data-world-method-order="${m.id}" ${s.purchaseQueue.orders.length>=6||s.purchaseQueue.orders.some(o=>o.type==='method'&&o.id===m.id)?'disabled':''}>${s.purchaseQueue.orders.some(o=>o.type==='method'&&o.id===m.id)?'Planned':'Plan'}</button>`:''}</div></article>`).join('')}</div><small>Equipment is active only while its Method is owned in this run.</small>`;}

 if(detail==='reference')return window.WTTNSecondaryScreens.reference(s,money);

 if(detail==='approaches')return `<h3>How will you work?</h3><p>First choice starts now. Later choices begin next Translation.</p><div class="approach-options">${G.SPECIALIZATIONS.map(a=>`<article><h4>${a.name}</h4><p>${esc(a.description)}</p><p class="muted">${{scholar:'For longer runs: develops after 10 minutes.',publisher:'For frequent returns: affordable expansion.',teacher:'For milestone and commission pursuit.'}[a.id]}</p><button data-world-approach="${a.id}" ${!G.specializationUnlocked(s)||s.specialization===a.id?'disabled':''}>${s.specialization===a.id?'Current approach':s.queuedSpecialization===a.id?'Queued for Translation':s.specialization?'Use '+a.name+' next Translation':'Choose '+a.name}</button></article>`).join('')}</div>${G.specializationUnlocked(s)?'':'<p>Purchase Organized Desk to choose.</p>'}`;

 if(detail==='plans')return `<h3>While you are away</h3><p>${esc(G.purchaseQueueStatus(s))}</p><ol class="planned-list">${s.purchaseQueue.orders.map((o,i)=>`<li><span>${o.type==='producer'?`Reach ${L.units(o.id,o.target)}`:G.PAGE_UPGRADES.find(p=>p.id===o.id).name}</span>${o.type==='producer'?`<input type="number" class="order-target" min="1" max="100000" step="1" data-world-target="${i}" value="${o.target}" aria-label="Target workforce for order ${i+1}"><button data-world-target-save="${i}" aria-label="Update target for order ${i+1}">Update</button>`:''}<button data-world-plan="${i}:up" aria-label="Move order ${i+1} up" ${i===0?'disabled':''}>Up</button><button data-world-plan="${i}:down" aria-label="Move order ${i+1} down" ${i===s.purchaseQueue.orders.length-1?'disabled':''}>Down</button><button data-world-plan="${i}:remove" aria-label="Cancel order ${i+1}">Cancel</button></li>`).join('')}</ol><form id="settlementPlan"><label>Target total · ${V.sites.find(p=>p.id===selected).name}<input id="settlementTarget" type="number" min="1" max="100000" step="1" value="${Math.max(10,s.producers[selected]+10)}" required></label><button ${!G.queueUnlocked(s)||s.purchaseQueue.orders.length>=6?'disabled':''}>Add order (${s.purchaseQueue.orders.length}/6)</button><button type="button" data-world-plan="0:pause" ${!G.queueUnlocked(s)?'disabled':''}>${s.purchaseQueue.paused?'Resume':'Pause'} plan</button></form><div class="plan-outcome"><strong>Expected outcome if funded</strong><p>${s.purchaseQueue.orders.length?s.purchaseQueue.orders.map(o=>o.type==='producer'?L.units(o.id,Math.max(s.producers[o.id],o.target)):G.PAGE_UPGRADES.find(m=>m.id===o.id).name+' equipped').join(' · '):'Choose the workforce or equipment you want ready on your return.'}</p></div><small>Orders spend Pages in sequence every ten seconds, online and offline. Completion time depends on changing production, prices and other automation. Plans never reset or enter Fields.</small>`;

 if(detail==='decorations'){const A=window.WTTNAppearance,placements=P.get().placements,current=placements[decorSelected],preview=A.preview(placements,decorSelected,decorSlot);return `<h3>Arrange your settlement</h3><p class="fineprint">Preview a clear garden location. All decorations are free.</p><label>Decoration<select id="decorationType">${A.definitions.map(d=>`<option value="${d.id}" ${d.id===decorSelected?'selected':''}>${d.name}</option>`).join('')}</select></label><div class="placement-locations" aria-label="Decoration locations">${A.choices(decorSelected).map((p,i)=>`<button data-placement="${p.id}" aria-pressed="${decorSlot===p.id}">${i+1}. ${p.name}${current===p.id?' · current':''}</button>`).join('')}</div><p class="placement-message" role="status">${preview.ok?current===decorSlot?'Placed here. Choose another location to move it.':'Clear ground · ready to place.':esc(preview.reason)}</p><details><summary>Curated arrangements</summary><div class="arrangement-presets">${Object.entries(A.presets).map(([id,p])=>`<button data-arrangement="${id}">${p.name}</button>`).join('')}</div></details><details><summary>Illustrated catalog · 12 objects</summary><div class="decoration-catalog">${A.definitions.map((d,i)=>`<button data-world-decor="${d.id}" aria-pressed="${decorSelected===d.id}" aria-label="Choose ${d.name}"><span class="decor-art" style="background-position:${i%4*100/3}% ${Math.floor(i/4)*50}%" aria-hidden="true"></span><span>${d.name}</span><small>${placements[d.id]?'Placed':'Not placed'}</small></button>`).join('')}</div></details><details><summary>Building colors and planting</summary><div class="decoration-options">${Object.entries({banner:['indigo','clay','olive'],planting:['olive','cypress','flowers'],courtyard:['planters','bench','fountain']}).map(([k,values])=>`<label>${k}<select data-decoration="${k}">${values.map(v=>`<option ${s.settlement.decorations[k]===v?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</div></details><p class="fineprint">Full backup includes this arrangement. A progress-only import leaves it unchanged. Decorations have no economic effect.</p>`;}

 return '';

}

function decorationActions(){const placements=P.get().placements,current=placements[decorSelected],preview=window.WTTNAppearance.preview(placements,decorSelected,decorSlot);return `<div class="placement-actions"><button id="placeDecoration" class="primary" ${!preview.ok||current===decorSlot?'disabled':''}>${current?'Move':'Place'} ${decorNames[decorSelected]}</button><button id="removeDecoration" ${!current?'disabled':''}>Remove</button></div>`;}
function update(s){if(!api)return;const next=V.derive(s),events=V.events(model,next);model=next;scene.update(next,events);

 for(const e of events){if(e.type==='finale')$('campaignCelebration').showModal();if(e.type==='departure'||e.type==='return'){document.body.classList.add('departing');setTimeout(()=>document.body.classList.remove('departing'),1200);api.toast(e.type==='return'?'Field experience returns home. Your settlement remembers the work.':'Your work travels onward. Discovered buildings remain; the workforce rebuilds.');}if(e.type==='commission'&&!s.settlement.onboarding.commission){s.settlement.onboarding.commission=true;$('celebrationDialog').showModal();}}

 const site=next.sites.find(x=>x.id===selected),def=G.PRODUCERS.find(p=>p.id===selected),preview=W.purchase(s,def,amount);

 for(const b of document.querySelectorAll('[data-site]')){const v=next.sites.find(x=>x.id===b.dataset.site);b.textContent=v.name;b.dataset.stage=v.stage;b.setAttribute('aria-pressed',String(v.id===selected));b.setAttribute('aria-label',`${v.name}. ${L.units(v.id,v.owned)}. ${v.discovered&&!v.operating?'Discovered, currently inactive.':v.available?'Select building':'Future building site'}`);}

 $('settlementTitle').textContent=site.name;$('workforceValue').textContent=L.units(selected,site.owned);$('buildingContribution').textContent=money(preview.contribution)+' Pages / sec';$('purchaseGain').textContent='+'+money(preview.gain)+' Pages / sec';$('purchaseCost').textContent=money(preview.quantity?preview.cost:preview.nextCost)+' Pages';$('hireLabel').textContent=site.owned?L.hire(selected,preview.quantity||1):(site.discovered?'Reopen ':'Establish ')+site.name;$('hireWorker').disabled=!preview.quantity;$('purchaseAvailability').textContent=preview.quantity?'':site.available?'Saving toward this purchase':'Future building · save Pages';$('nextMilestone').textContent=window.WTTNPresentationDisclosure.milestone(s,selected);$('buildingCondition').textContent=site.owned?'WORKING SETTLEMENT':site.discovered?'DISCOVERED · WORKFORCE REBUILDS':'A NEW BEGINNING';scene.portrait($('trayPortrait'),site);

 $('chapterTitle').textContent=next.chapter.title;$('chapterTitle').title=next.chapter.text;$('chapterAction').setAttribute('aria-description',next.chapter.text);$('chapterText').textContent=next.chapter.text;$('chapterAction').textContent=next.chapter.action;$('chapterProgress').value=next.chapter.progress;

 const disclosure=window.WTTNDisclosure.getDisclosure(s,G);for(const b of document.querySelectorAll('[data-route]')){b.disabled=!disclosure.tabs[b.dataset.route];b.setAttribute('aria-pressed',String(activePanel===b.dataset.route));if(b.disabled)b.querySelector('small').textContent={network:'Develop Translation',fields:'4 lifetime NC + 1 this cycle',legacy:'70 FE this era'}[b.dataset.route]||'Later';else b.querySelector('small').textContent={translation:'Send prepared work',network:'Build connections',fields:'Listen and adapt',legacy:'Carry experience forward',insight:'Develop what you have learned'}[b.dataset.route];b.title=b.disabled?({network:'Develop Translation automation or earn enough Insight for your first Network.',fields:'Reach 4 lifetime NC and earn at least 1 NC in this Field cycle.',legacy:'Earn 70 Field Experience toward your first Legacy.'}[b.dataset.route]||'Available later'):'Open decision briefing';}

 $('journeyCaption').textContent=s.field.active?'You are working in a Field. Home architecture is remembered; economic constraints apply to the current run.':'A symbolic game world. Reach and production describe the work, never spiritual worth.';

 $('libraryReferenceButton').hidden=selected!=='scriptorium'||!s.pageUpgrades.reference;

 $('awaySummary').textContent=s.purchaseQueue.orders.length?`${s.purchaseQueue.orders.length} planned orders · ${s.purchaseQueue.paused?'paused':'working while away'}`:'Your work continues while you are away';

 const balances=[['TI','Translation Insight',s.ti,s.translations||s.ti.gt(0)],['NC','Network Capacity',s.nc,s.networks],['FE','Field Experience',s.fe,s.field.index||s.fe.gt(0)],['Legacy','Legacy',s.legacy,s.legacies]].filter(x=>x[3]);$('resourceBalances').hidden=!balances.length;$('settlementCurrencies').textContent=balances.map(x=>money(x[2])+' '+x[0]).join(' · ');patch($('currencyBreakdown'),()=>balances.map(x=>`<div><span>${x[1]}</span><strong>${money(x[2])}</strong></div>`).join(''));



 

 const extraEl=$('trayExtra');$('selectionTray').dataset.detail=detail;extraEl.hidden=!detail;if(detail)$('selectionTray').dataset.sheet='detail';else if($('selectionTray').dataset.sheet==='detail')$('selectionTray').dataset.sheet='expanded';const expanded=$('selectionTray').dataset.sheet!=='compact';$('sheetToggle').setAttribute('aria-expanded',String(expanded));$('sheetToggle').setAttribute('aria-label',expanded?'Collapse building sheet':'Expand building sheet');patch(extraEl,()=>extra(s));const detailKey=detail+':'+selected+':'+(detail==='decorations'?decorSelected:'');if(detailKey!==lastDetailKey){extraEl.scrollTop=0;lastDetailKey=detailKey;}$('trayActions').hidden=detail!=='decorations';patch($('trayActions'),()=>detail==='decorations'?decorationActions():'');wireExtra();

 scene.previewAppearance(detail==='decorations'?window.WTTNAppearance.preview(P.get().placements,decorSelected,decorSlot):null,detail==='decorations'?window.WTTNAppearance.choices(decorSelected):[],slot=>{decorSlot=slot;update(api.getState());});

 for(const btn of document.querySelectorAll('[data-tray-detail]')){btn.setAttribute('aria-expanded',String(detail===btn.dataset.trayDetail));}

 for(const btn of document.querySelectorAll('[data-world-quantity]'))btn.setAttribute('aria-pressed',String(btn.dataset.worldQuantity===amount));

 // The list is the complete keyboard/screen-reader alternative, including future sites.

 patch($('buildingList'),()=>next.sites.map(p=>`<button data-list-site="${p.id}"><strong>${p.name}</strong><span>${L.units(p.id,p.owned)} · ${money(p.contribution)} Pages/sec</span></button>`).join(''));

 document.querySelectorAll('[data-list-site]').forEach(b=>b.onclick=()=>{$('buildingDialog').close();choose(b.dataset.listSite,true);});

 for(const id of ['translationDepthPanel','networkDepthPanel']){const p=$(id);if(p?.parentElement.classList.contains('advanced-efficiency'))p.parentElement.hidden=p.classList.contains('hidden');}

 window.WTTNJourney.update(activePanel,s);document.body.classList.toggle('journey-animated',!P.reduced());

 if(activePanel==='stats')$('rendererStats').textContent=JSON.stringify(scene.stats(),null,2);

}

function wireExtra(){if($('decorationType'))$('decorationType').onchange=e=>{decorSelected=e.target.value;decorSlot=P.get().placements[decorSelected]||'home';update(api.getState());};document.querySelectorAll('[data-world-decor]').forEach(b=>b.onclick=()=>{decorSelected=b.dataset.worldDecor;decorSlot=P.get().placements[decorSelected]||'home';update(api.getState());});document.querySelectorAll('[data-placement]').forEach(b=>b.onclick=()=>{decorSlot=b.dataset.placement;update(api.getState());});document.querySelectorAll('[data-arrangement]').forEach(b=>b.onclick=()=>{const preset=window.WTTNAppearance.presets[b.dataset.arrangement];if(P.set('placements',preset.placements)){decorSlot=P.get().placements[decorSelected]||'home';update(api.getState());api.toast(preset.name+' arranged');}else api.toast('Could not save this arrangement.');});if($('placeDecoration'))$('placeDecoration').onclick=()=>{const next={...P.get().placements,[decorSelected]:decorSlot};if(P.set('placements',next)){update(api.getState());document.querySelector('[data-placement="'+decorSlot+'"]')?.focus({preventScroll:true});api.sound('select');api.toast(decorNames[decorSelected]+' placed');}else api.toast('This location cannot be saved.');};if($('removeDecoration'))$('removeDecoration').onclick=()=>{const next={...P.get().placements};delete next[decorSelected];if(P.set('placements',next)){update(api.getState());api.toast(decorNames[decorSelected]+' removed');}};document.querySelectorAll('[data-world-target-save]').forEach(b=>b.onclick=()=>{const i=b.dataset.worldTargetSave;dispatch('queue-target',i,document.querySelector('[data-world-target="'+i+'"]').value);});document.querySelectorAll('[data-world-target]').forEach(b=>b.onchange=()=>dispatch('queue-target',b.dataset.worldTarget,b.value));document.querySelectorAll('[data-world-method]').forEach(b=>b.onclick=()=>dispatch('method',b.dataset.worldMethod));document.querySelectorAll('[data-world-method-order]').forEach(b=>b.onclick=()=>dispatch('method-order',b.dataset.worldMethodOrder));document.querySelectorAll('[data-world-approach]').forEach(b=>b.onclick=()=>dispatch('approach',b.dataset.worldApproach));document.querySelectorAll('[data-world-plan]').forEach(b=>b.onclick=()=>{const [i,a]=b.dataset.worldPlan.split(':');dispatch('queue-edit',i,a);});document.querySelectorAll('[data-decoration]').forEach(b=>b.onchange=()=>dispatch('decoration',b.dataset.decoration,b.value));if($('settlementPlan'))$('settlementPlan').onsubmit=e=>{e.preventDefault();if(dispatch('queue',selected,$('settlementTarget').value))api.toast('Order added to your purchasing plan');};}

function init(bridge){api=bridge;document.body.dataset.surface='settlement';scene=window.WTTNSettlementScene.create($('settlementCanvas'),$('buildingLabels'),id=>choose(id),api.reduced);

 $('buildingLabels').innerHTML=V.sites.map(s=>`<button data-site="${s.id}" class="building-label">${s.name}</button>`).join('');document.querySelectorAll('[data-site]').forEach(b=>{b.onclick=()=>choose(b.dataset.site);b.onfocus=()=>choose(b.dataset.site);});

 window.WTTNJourney.init(open);

 $('campaignCelebration').addEventListener('close',()=>{close();scene.fit();$('buildingListButton').focus({preventScroll:true});});

 $('sheetToggle').onclick=()=>{const el=$('selectionTray'),expand=el.dataset.sheet==='compact';detail='';el.dataset.sheet=expand?'expanded':'compact';$('sheetToggle').setAttribute('aria-expanded',String(expand));$('sheetToggle').setAttribute('aria-label',expand?'Collapse building sheet':'Expand building sheet');update(api.getState());scene.select(selected);};

 document.querySelectorAll('[data-visual]').forEach(el=>{el.value=P.get()[el.dataset.visual];el.onchange=()=>{P.set(el.dataset.visual,el.value);update(api.getState());};});

 document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>open(b.dataset.route));

 $('hireWorker').onclick=()=>dispatch('hire');document.querySelectorAll('[data-world-quantity]').forEach(b=>b.onclick=()=>{amount=b.dataset.worldQuantity;update(api.getState());});

 document.querySelectorAll('[data-tray-detail]').forEach(b=>b.onclick=()=>{detail=detail===b.dataset.trayDetail?'':b.dataset.trayDetail;update(api.getState());scene.select(selected);});

 $('closeTrayExtra').onclick=()=>{const prior=detail;detail='';$('selectionTray').dataset.sheet='expanded';update(api.getState());scene.frameSelection();document.querySelector('[data-tray-detail="'+prior+'"]')?.focus();};

 $('chapterAction').onclick=()=>{const c=model.chapter;if(c.building)choose(c.building);if(c.screen)open(c.screen);else if(c.detail){detail=c.detail;update(api.getState());}};

 document.querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>{const id=b.dataset.destination;if(id==='settlement')close();else open(id==='codex'?'scripture':'translation');});

 document.querySelectorAll('[data-open-screen]').forEach(b=>b.onclick=()=>open(b.dataset.openScreen));

 $('closeScreen').onclick=()=>{close();focusOrigin?.focus();};$('buildingListButton').onclick=()=>$('buildingDialog').showModal();$('zoomWorldIn').onclick=()=>scene.zoom(.15);$('zoomWorldOut').onclick=()=>scene.zoom(-.15);$('fitWorld').onclick=()=>scene.fit();

 $('decorationButton').onclick=()=>{close();detail=detail==='decorations'?'':'decorations';update(api.getState());};

 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open],.modal-backdrop:not(.hidden)')){if(detail){detail='';update(api.getState());}else close();}});

 $('settlementCanvas').addEventListener('keydown',e=>{const index=V.sites.findIndex(s=>s.id===selected);if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();choose(V.sites[(index+(e.key==='ArrowRight'?1:5))%6].id);}if(e.key==='Enter'){e.preventDefault();$('hireWorker').focus();}});

}

window.WTTNSettlement={init,update,screen,nextAction:()=>{close();$('chapterAction').click();},refresh:()=>update(api.getState()),seed:()=>{model=null;window.WTTNJourney.resetSelection();},stats:()=>scene?.stats()};

})();

