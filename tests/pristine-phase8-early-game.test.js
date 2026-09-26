'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const text=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const G=require('../game-core.js');
const E=require('../early-game.js');

assert.strictEqual(E.version,'1.8.0');
const fresh=G.createState();
let guide=E.getGuide(fresh,G);
assert(guide.active);
assert(/Scribe/.test(guide.title));
assert.strictEqual(guide.chapters.length,4);
assert.strictEqual(guide.chapters[0].state,'current');

fresh.producers.scribe=1;
guide=E.getGuide(fresh,G); assert(/Copyist/.test(guide.title));
fresh.producers.copyist=1; guide=E.getGuide(fresh,G); assert(/Method/.test(guide.title));
fresh.pageUpgrades.desk=1; guide=E.getGuide(fresh,G); assert(/Editor/.test(guide.title));
fresh.producers.editor=1; guide=E.getGuide(fresh,G); assert(/Teacher/.test(guide.title));
fresh.producers.teacher=1; guide=E.getGuide(fresh,G); assert(/Manuscript/.test(guide.title));

// First-run Translation remains available early, while guidance recommends the intended window.
const reset=G.createState(); reset.peakPages=G.bn('1e12'); reset.pages=G.bn('1e12'); reset.runTime=19*60; for (const id of Object.keys(reset.producers)) reset.producers[id]=1; reset.pageUpgrades.desk=1; reset.projects={manuscript:true,reference:true,teaching:true};
guide=E.getGuide(reset,G);
assert(guide.active && /available now/.test(guide.title));
assert.strictEqual(guide.action.tab,'translation');
reset.runTime=24*60; guide=E.getGuide(reset,G); assert(/nearly mature/.test(guide.title));
reset.runTime=25*60; guide=E.getGuide(reset,G); assert.strictEqual(guide.tone,'ready'); assert(/Complete your first Translation/.test(guide.title));
reset.lifetimeTi=G.bn(1); reset.translations=1; assert.strictEqual(E.getGuide(reset,G).active,false);

function act(s){
  for(const p of G.PROJECTS) if(G.projectStatus(s,p.id).available&&!s.projects[p.id]){G.completeProject(s,p.id);return true;}
  for(const u of G.PAGE_UPGRADES) if(!s.pageUpgrades[u.id]&&s.pages.gte(u.cost)){G.buyPageUpgrade(s,u.id);return true;}
  for(const p of [...G.PRODUCERS].reverse()) if(G.maxAffordableProducerCount(s,p.id,10000)>0){G.buyProducer(s,p.id,'max');return true;}
  return false;
}
// Audit the actual certified early economy rather than inventing tutorial timestamps.
const s=G.createState(); let next=0; const at={};
while(s.timePlayed<35*60){
  if(s.timePlayed>=next-1e-9){let n=0;while(n++<160&&act(s)){} next=s.timePlayed+15;}
  if(!at.scribe&&s.producers.scribe) at.scribe=s.timePlayed;
  if(!at.copyist&&s.producers.copyist) at.copyist=s.timePlayed;
  if(!at.editor&&s.producers.editor) at.editor=s.timePlayed;
  if(!at.teacher&&s.producers.teacher) at.teacher=s.timePlayed;
  if(!at.manuscript&&s.projects.manuscript) at.manuscript=s.timePlayed;
  if(!at.reference&&s.projects.reference) at.reference=s.timePlayed;
  if(!at.teaching&&s.projects.teaching) at.teaching=s.timePlayed;
  if(!at.scriptorium&&s.producers.scriptorium) at.scriptorium=s.timePlayed;
  if(!at.threshold&&s.peakPages.gte(G.translationThreshold(s))) at.threshold=s.timePlayed;
  G.tick(s,1);
}
assert(at.scribe<=30,'first producer too late');
assert(at.copyist<=90,'Copyist too late');
assert(at.editor<=180,'Editor too late');
assert(at.teacher<=360,'Teacher too late');
assert(at.manuscript>=3*60&&at.manuscript<=10*60,'first Project outside intended window');
assert(at.teaching<=16*60,'Projects not complete by 16m');
assert(at.scriptorium>=18*60&&at.scriptorium<=28*60,'Scriptorium outside intended window');
assert(at.threshold>=20*60&&at.threshold<=30*60,'Translation threshold outside intended window');
// The guide intentionally fills the threshold→35m waiting period with reset-readiness context.
assert(E.getGuide(s,G).tone==='ready');

const html=text('index.html'), app=text('app.js'), css=text('styles.css'), sw=text('sw.js');
for(const id of ['earlyJourney','earlyJourneyTitle','earlyJourneyChapter','earlyJourneySummary','earlyJourneyMetrics','earlyJourneyAction','earlyJourneyTip','earlyJourneyRail']) assert(html.includes(`id="${id}"`),`missing early guide ${id}`);
assert(html.includes('<script src="early-game.js"></script>'));
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['early-game.js']), 'module must be included in the cached document');
assert(app.includes('const E = window.WTTNEarlyGame'));
assert(app.includes('function renderEarlyJourney()'));
assert(css.includes('.early-journey'));
assert.strictEqual(JSON.parse(text('package.json')).version,'2.10.4');
console.log(`Pristine Phase 8 early game: PASS · first Project ${(at.manuscript/60).toFixed(2)}m · all Projects ${(at.teaching/60).toFixed(2)}m · Scriptorium ${(at.scriptorium/60).toFixed(2)}m · threshold ${(at.threshold/60).toFixed(2)}m · mature guide 25m`);
