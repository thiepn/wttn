const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('../game-core.js');
const L = require('../legacy-depth.js');
const root = path.resolve(__dirname,'..');
const text = f => fs.readFileSync(path.join(root,f),'utf8');

assert.strictEqual(JSON.parse(text('package.json')).version,'2.10.5');
assert(text('app.js').includes("const APP_VERSION = '2.10.5'"));
assert(text('sw.js').includes("const BUILD='__BUILD_ID__'"));
assert(text('index.html').includes('legacy-depth.js'));
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['legacy-depth.js']), 'module must be included in cached document');

// Four deterministic Mature patterns, schema-free and balanced around the previous average.
assert.strictEqual(G.MATURE_FIELD_PATTERNS.length,4);
const difficulties = G.MATURE_FIELD_PATTERNS.map(x=>x.difficulty);
assert(Math.abs(difficulties.reduce((a,b)=>a+b,0)/4 - 4.0) < 1e-9);
{
  const s=G.createState();
  s.field.cleared=G.FIELDS.map(f=>f.id); s.field.index=G.FIELDS.length;
  const names=[];
  for(let i=0;i<4;i++){ s.field.matureClears=i; names.push(G.matureFieldForState(s).patternId); }
  assert.deepStrictEqual(names,['stewardship','translation','distribution','integration']);
  s.field.matureClears=4; assert.strictEqual(G.matureFieldForState(s).patternId,'stewardship');
}

// Final campaign now includes one complete Mature-cycle set.
{
  const s=G.createState(); s.lifetimeLegacy=G.bn(100); s.campaign={tier1:5,tier2:3,tier3:1,complete:false};
  s.field.cleared=G.FIELDS.map(f=>f.id); s.field.index=G.FIELDS.length;
  s.field.matureClears=3; assert(!G.finalSequenceAvailable(s));
  s.field.matureClears=4; assert(G.finalSequenceAvailable(s));
}

// Traditions now have different endgame behaviors without new currencies.
{
  const base=G.createState(); base.lifetimeNc=G.bn(10); base.translations=2;
  const tr=G.reviveState(JSON.parse(G.serializeState(base))); tr.tradition='translation';
  assert(G.translationReadinessTarget(tr) < G.translationReadinessTarget(base));

  const dist=G.reviveState(JSON.parse(G.serializeState(base))); dist.tradition='distribution'; dist.networks=1;
  dist.allocation={local:.25,regional:.25,international:.25,digital:.25};
  base.networks=1; base.allocation={...dist.allocation};
  assert(G.allocationSynergies(dist).insightBridge > G.allocationSynergies(base).insightBridge);

  const pioneer=G.createState(); pioneer.legacies=1; pioneer.tradition='pioneer'; pioneer.lifetimeNc=G.bn(100); pioneer.ncThisField=G.bn(0);
  assert(G.canEnterField(pioneer,'urban'), 'Pioneer should waive fresh-NC entry preparation after the first Legacy');
}

// Planner is pure and exposes next milestone, Mature pattern and campaign set.
{
  const s=G.createState(); s.legacies=1; s.tradition='teaching'; s.lifetimeLegacy=G.bn(15);
  s.field.cleared=G.FIELDS.map(f=>f.id); s.field.index=G.FIELDS.length; s.field.matureClears=2;
  const before=JSON.parse(G.serializeState(s)); delete before.lastSavedAt; const plan=L.legacyPlan(s,G); const campaign=L.campaignPlan(s,G);
  assert.strictEqual(plan.profile.id,'teaching');
  assert.strictEqual(plan.mature.field.patternId,'distribution');
  assert.strictEqual(campaign.mature.current,2);
  const after=JSON.parse(G.serializeState(s)); delete after.lastSavedAt; assert.deepStrictEqual(before,after);
}

// UI contains the endgame planning surfaces.
const html=text('index.html');
assert(html.includes('id="legacyStrategyBoard"'));
assert(text('app.js').includes('Mature cycle set'));
assert(text('app.js').includes('WTTNLegacyDepth'));
assert(text('styles.css').includes('legacy-strategy-board'));

console.log('Pristine Phase 11 Legacy & Endgame Depth tests: PASS');
