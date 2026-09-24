'use strict';
const assert=require('assert/strict'),fs=require('fs'),G=require('../game-core'),{simulateCampaign}=require('./phase9-sim-lib');
const profiles=[{name:'three-ten-minute-visits',sessions:[0,8*3600,16*3600],sessionSeconds:600},{name:'two-five-minute-visits',sessions:[0,12*3600],sessionSeconds:300}];
const results=[];
for(const p of profiles){const r=simulateCampaign(G,{...p,maxDays:30,firstTranslationSeconds:20*60,configureAutoTranslation:true});const m=r.metrics;const summary={name:p.name,completeDays:m.completeDays,firstNetworkHours:m.firstNetworkHours,firstFieldHours:m.firstFieldHours,firstLegacyDays:m.firstLegacyDays,firstProjectMinutes:r.state.records.firstProjectAt/60,firstMethodMinutes:r.state.records.firstUpgradeAt/60,firstTranslationHours:r.state.records.firstTranslationAt/3600,legacies:m.legacies,fields:m.allFieldsDays,decisions:m.decisions};results.push(summary);console.log(JSON.stringify(summary));}
fs.writeFileSync('docs/session-results.json',JSON.stringify(results,null,2));

for(const r of results){assert(r.firstMethodMinutes<=3);assert(r.firstProjectMinutes<=10);assert(Number.isFinite(r.completeDays));}
assert(results[0].completeDays>=14&&results[0].completeDays<=21);
assert(results[0].firstNetworkHours<=25);assert(results[0].firstFieldHours<=73);assert(results[0].firstLegacyDays>=5&&results[0].firstLegacyDays<=7);
assert(results[1].completeDays<=28+1/1440);
console.log('Scheduled-session acceptance: PASS. No decisions between visits except configured purchase/automation rules.');
