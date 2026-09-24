'use strict';
const G=require('../game-core.js');
const {simulateCampaign}=require('./phase9-sim-lib.js');
const combos=[
  ['translation','scholar'],
  ['teaching','teacher'],
  ['distribution','publisher'],
  ['pioneer','publisher']
];
for(const [tradition,specialization] of combos){
  const r=simulateCampaign(G,{name:`${tradition}-${specialization}`,tradition,specialization,fieldRouteMode:'canonical',maxDays:22});
  console.log(`${tradition.padEnd(12)} ${(r.state.records.campaignCompleteAt/86400).toFixed(3)}d · ${specialization.padEnd(9)} · Mature ${r.state.field.matureClears} · Lifetime L ${r.state.lifetimeLegacy.format(0)}`);
}
