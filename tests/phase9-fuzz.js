'use strict';
const assert = require('assert');
const G = require('../game-core.js');
const { simulateCampaign, makeRng } = require('./phase9-sim-lib.js');
const rng = makeRng(20260917);
const rows=[];
for(let i=0;i<12;i++){
  const st={
    name:`fuzz-${i}`, seed:100+i, maxDays:20,
    decisionSeconds:[60,120,300][Math.floor(rng()*3)],
    specialization:['scholar','publisher','teacher'][Math.floor(rng()*3)],
    tradition:['translation','teaching','distribution','pioneer'][Math.floor(rng()*4)],
    firstTranslationSeconds:[30,35,40][Math.floor(rng()*3)]*60,
    networkMinSeconds:[1800,3600,7200][Math.floor(rng()*3)],
    networkMultiple:[1.1,1.3,1.5,2][Math.floor(rng()*4)],
    networkMaxSeconds:[2,3,4,6][Math.floor(rng()*4)]*3600,
    legacyMinSeconds:[4,8,12,24][Math.floor(rng()*4)]*3600,
    legacyMultiple:[1.1,1.3,1.5,2][Math.floor(rng()*4)],
    legacyMaxSeconds:[12,24,48,72][Math.floor(rng()*4)]*3600,
    tiOrder:['one-time-first','repeatables-first','workflow-heavy'][Math.floor(rng()*3)],
    networkOrder:rng()<.5?'infrastructure-first':'one-time-first',
    producerOrder:'high-tier-first',
    allocationMode:['optimized','balanced','international-heavy'][Math.floor(rng()*3)],
    fieldRouteMode:['canonical','frontier-fast','retention-first','distribution-first','hard-first','random'][Math.floor(rng()*6)]
  };
  const r=simulateCampaign(G,st); const m=r.metrics;
  rows.push({name:st.name,days:m.completeDays,fastT:m.fastestTranslation,fastN:m.fastestNetwork,spec:st.specialization,trad:st.tradition,route:st.fieldRouteMode});
  if(Number.isFinite(m.completeDays)) {
    assert(m.completeDays>=8,`${st.name} broke optimized floor at ${m.completeDays.toFixed(3)}d`);
    assert(m.fastestTranslation==null||m.fastestTranslation>=90,`${st.name} Translation collapse`);
    assert(m.fastestNetwork==null||m.fastestNetwork>=300,`${st.name} Network collapse`);
  }
  console.log(`FUZZ ${st.name} ${Number.isFinite(m.completeDays)?m.completeDays.toFixed(3)+'d':'>20d'} · ${st.specialization}/${st.tradition} · ${st.fieldRouteMode}`);
}
const finite=rows.filter(r=>Number.isFinite(r.days));
assert(finite.length>=6,`Only ${finite.length}/12 fuzz strategies completed within 20d`);
const fastest=finite.reduce((a,b)=>a.days<b.days?a:b);
console.log(`Phase 9 fuzz fastest: ${fastest.name} ${fastest.days.toFixed(3)}d · ${fastest.spec}/${fastest.trad} · ${fastest.route}`);
console.log('Phase 9 randomized exploit search: PASS');
