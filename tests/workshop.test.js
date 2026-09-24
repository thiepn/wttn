'use strict';
const assert=require('assert/strict'),G=require('../game-core'),S=require('../save-format'),W=require('../workshop-model'),D=require('../disclosure'),Bible=require('../scripture-data');
// Old early, middle, and late saves keep currencies and lifetime counters; credit occurs once.
for(const level of [0,1,2])for(const paid of [false,true]){
 const original=G.createState();original.version=6;original.pages=G.bn('1e24');original.ti=G.bn(57);original.lifetimeTi=G.bn(800);original.tiThisNetwork=G.bn(300);original.translations=level*10;original.networks=level*3;original.legacies=level;original.tiOneTime.buyMax=paid;delete original.purchaseQueue;delete original.reading;
 const raw=JSON.parse(JSON.stringify(original)),s=G.reviveState(raw);assert.equal(s.version,8);assert(s.ti.eq(paid?87:57));assert(s.lifetimeTi.eq(800));assert(s.tiThisNetwork.eq(300));assert(s.pages.eq(original.pages));assert.deepEqual(s.purchaseQueue,{paused:false,orders:[]});assert.equal(s.legacies,level);
 const restored=S.parseSaveText(S.makeEnvelope(s)).state;assert(restored.ti.eq(s.ti));assert.deepEqual(raw,JSON.parse(JSON.stringify(original)));
}
assert(G.hasBuyMax(G.createState()));assert(D.getDisclosure(G.createState(),G).tabs.scripture);
// The queue is finite, validates targets, respects pause/order/cancel, and remains a purchase-only API.
const q=G.createState();assert(!G.enqueuePurchase(q,{type:'producer',id:'scribe',target:10}));q.pageUpgrades.desk=1;
assert(!G.enqueuePurchase(q,{type:'producer',id:'scribe',target:Infinity}));assert(!G.enqueuePurchase(q,{type:'reset',id:'translation'}));
for(let i=1;i<=6;i++)assert(G.enqueuePurchase(q,{type:'producer',id:'scribe',target:i*10}));assert(!G.enqueuePurchase(q,{type:'method',id:'copying'}));
G.editPurchaseQueue(q,5,'up');assert.equal(q.purchaseQueue.orders[4].target,60);G.editPurchaseQueue(q,4,'down');assert.equal(q.purchaseQueue.orders[5].target,60);G.editPurchaseQueue(q,5,'remove');assert.equal(q.purchaseQueue.orders.length,5);
q.pages=G.bn('1e12');G.editPurchaseQueue(q,0,'pause');G.tick(q,30);assert.equal(q.producers.scribe,0);G.editPurchaseQueue(q,0,'pause');G.tick(q,10);assert.equal(q.producers.scribe,50);assert.equal(q.purchaseQueue.orders.length,0);assert.equal(q.translations,0);
// A blocked order cannot silently skip ahead, and manual progress completes orders safely.
q.purchaseQueue.orders=[];q.pages=G.bn(100);G.enqueuePurchase(q,{type:'method',id:'shared'});G.enqueuePurchase(q,{type:'producer',id:'copyist',target:1});G.runPurchaseQueue(q);assert.equal(q.producers.copyist,0);G.editPurchaseQueue(q,0,'remove');G.runPurchaseQueue(q);assert.equal(q.producers.copyist,1);
// Online 1s chunks versus offline 10s integration, covering absence for up to a week.
for(const seconds of [3600,28800,86400,604800]){
 const base=G.createState();base.pageUpgrades.desk=1;G.enqueuePurchase(base,{type:'producer',id:'copyist',target:25});G.enqueuePurchase(base,{type:'method',id:'copying'});G.enqueuePurchase(base,{type:'producer',id:'editor',target:10});
 const online=G.reviveState(JSON.parse(JSON.stringify(base))),offline=G.reviveState(JSON.parse(JSON.stringify(base)));
 for(let t=0;t<seconds;t++)G.tick(online,1);G.simulateOffline(offline,seconds);
 assert.deepEqual(online.producers,offline.producers);assert.deepEqual(online.pageUpgrades,offline.pageUpgrades);assert.deepEqual(online.purchaseQueue,offline.purchaseQueue);assert(Math.abs(online.pages.log10-offline.pages.log10)<1e-8);assert.equal(online.translations,offline.translations);
}
// Pure previews report the exact selected bulk purchase and every production tier.
const state=G.createState();state.pages=G.bn(10000);state.producers.scribe=9;
const before=JSON.stringify(state),preview=W.purchase(state,G.PRODUCERS[0],'10');assert.equal(JSON.stringify(state),before);
const actual=G.reviveState(JSON.parse(before)),old=G.pageProduction(actual),bought=G.buyProducer(actual,'scribe',10);assert(preview.cost.eq(bought.spent));assert(preview.gain.eq(G.pageProduction(actual).sub(old)));assert(preview.contribution.gt(0));
state.peakPages=G.bn('1e14');const snapshot=JSON.stringify(state);const reset=W.resetPreview(state,'translation');assert(reset&&reset.gain.gte(1));assert.equal(JSON.stringify(state),snapshot);
assert.equal(W.scene(G.createState()).id,'copying');state.legacies=1;assert.equal(W.scene(state).id,'legacy');
// Hostile queue/reading data cannot introduce markup, prototype keys, or unbounded arrays.
const hostile=G.reviveState({version:7,purchaseQueue:{orders:[{type:'producer',id:'__proto__',target:1},{type:'method',id:'<img>'}]},reading:{bookmarks:['<svg>','john-1-1-1'],fontSize:9999}});assert.equal(hostile.purchaseQueue.orders.length,0);assert.deepEqual(hostile.reading.bookmarks,['john-1-1-1']);assert.equal(hostile.reading.fontSize,18);
assert.equal(Bible.entries.length,83);for(const entry of Bible.entries){const chapter=Bible.chapters[entry.chapterKey];assert(chapter.source.startsWith('https://ebible.org/engwebp/'));for(let n=entry.start;n<=entry.end;n++)assert(chapter.verses.some(v=>v.number===n));}
assert(Bible.chapters['JHN-20'].verses.find(v=>v.number===21).text.includes('Peace be to you.'));
console.log('Living Workshop: PASS — schema migration, once-only credit, queue safety, 1h/8h/24h/7d offline parity, pure previews, Scripture integrity.');
const first=G.createState();G.tick(first,5);assert.equal(G.buyProducer(first,'scribe',1).bought,1);
// Fractional frame timing, saved midpoint, and offline replay use the same order cadence.
const fractional=G.createState();fractional.pageUpgrades.desk=1;G.enqueuePurchase(fractional,{type:'producer',id:'copyist',target:25});
const whole=G.reviveState(JSON.parse(JSON.stringify(fractional)));
for(let i=0;i<36000;i++)G.tick(fractional,0.1);G.simulateOffline(whole,3600);
assert.deepEqual(fractional.producers,whole.producers);assert(Math.abs(fractional.pages.log10-whole.pages.log10)<1e-8);
const saved=G.reviveState(JSON.parse(JSON.stringify(fractional)));G.tick(saved,60);G.tick(fractional,60);assert.deepEqual(saved.purchaseQueue,fractional.purchaseQueue);assert(saved.pages.eq(fractional.pages));
// Planned order retention follows the stated reset rewards.
for(const retain of [false,true]){const r=G.createState();r.translations=2;r.tiThisNetwork=G.bn('1e6');r.netOneTime.persistentWorkflow=retain;G.enqueuePurchase(r,{type:'producer',id:'scriptorium',target:100});assert(G.completeNetwork(r).ok);assert.equal(r.purchaseQueue.orders.length,retain?1:0);}
const trans=G.createState();trans.pageUpgrades.desk=1;trans.peakPages=G.bn('1e20');G.enqueuePurchase(trans,{type:'producer',id:'scriptorium',target:100});assert(G.completeTranslation(trans).ok);assert.equal(trans.purchaseQueue.orders.length,1);
console.log('First purchase, fractional frames, queue serialization and reset retention: PASS.');
