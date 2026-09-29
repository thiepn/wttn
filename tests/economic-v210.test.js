'use strict';
const assert=require('assert/strict'),fs=require('fs'),A=require('../game-core');
const realNow=Date.now;Date.now=()=>1790190000000;let snapshots=0;
function trace(G,approach){
  const s=G.createState(),out=[];
  s.pages=G.bn('1e16');s.peakPages=s.pages.clone();G.buyProducer(s,'scribe',10);G.buyPageUpgrade(s,'desk');
  if(approach){s.lifetimeTi=G.bn(100);G.setSpecialization(s,approach);}
  const record=()=>out.push(JSON.stringify(s));
  for(let i=0;i<150;i++){
    G.tick(s,30);
    for(const p of G.PRODUCERS)G.buyProducer(s,p.id,i%9===0?'max':1);
    for(const u of G.PAGE_UPGRADES)G.buyPageUpgrade(s,u.id);
    for(const p of G.PROJECTS)G.completeProject(s,p.id);
    if(i===10){G.enqueuePurchase(s,{type:'producer',id:'copyist',target:80});G.enqueuePurchase(s,{type:'method',id:'translationPrep'});}
    if(i===20)G.editPurchaseQueue(s,0,'pause');
    if(i===25)G.editPurchaseQueue(s,0,'pause');
    if(i%45===0)G.completeTranslation(s);
    record();
  }
  for(const seconds of [3600,28800,86400,604800]){G.simulateOffline(s,seconds);record();}
  s.tiThisNetwork=G.bn('1e6');assert(G.completeNetwork(s).ok);record();
  s.lifetimeNc=G.bn(10);s.ncThisField=G.bn(5);s.nc=G.bn(5);G.enterField(s,'urban');record();
  s.field.progressNc=G.bn(100);s.field.stats.validNetworks=8;s.field.stats.translations=8;s.feThisLegacy=G.bn(100);s.fe=G.bn(100);s.field.active=false;assert(G.completeLegacy(s).ok);record();
  return out;
}
try{
  for(const approach of [null,'scholar','publisher','teacher']){
    const a=trace(A,approach),b=trace(A,approach);
    assert.deepEqual(a,b);
    snapshots+=a.length;
    console.log('PASS deterministic hotfix command trace: '+(approach||'no approach'));
  }
}finally{Date.now=realNow;}
fs.mkdirSync('docs/qa-v2.10',{recursive:true});
fs.writeFileSync('docs/qa-v2.10/economic-parity.json',JSON.stringify({
  snapshots,approaches:4,intervalsSeconds:[3600,28800,86400,604800],
  baseline:'v2.9 gameplay parity intentionally retired after progression-safety hotfixes',
  deterministic:true
},null,2));
