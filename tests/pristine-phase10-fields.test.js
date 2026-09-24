'use strict';
const assert = require('assert');
const fs = require('fs');
const G = require('../game-core.js');
const A = require('../atlas.js');
const F = require('../field-depth.js');
const { simulateCampaign, BASE_STRATEGY } = require('./phase9-sim-lib.js');

function entryState() {
  const s = G.createState();
  s.phase3Complete = true;
  s.lifetimeNc = G.bn(12);
  s.ncThisField = G.bn(1);
  return s;
}
function forceClear(s, id) {
  s.ncThisField = G.bn(1);
  assert(G.canEnterField(s, id), `${id} should be enterable`);
  assert(G.enterField(s, id).ok, `${id} should enter`);
  const f = G.currentField(s);
  s.field.progressNc = G.fieldThreshold(s, f);
  s.field.stats.validNetworks = f.objective?.validNetworks || 1;
  s.field.stats.networks = s.field.stats.validNetworks;
  s.field.stats.translations = f.objective?.translations || 0;
  if (f.requireAllProjects) s.field.stats.projects = G.PROJECTS.map(p => p.id);
  assert(G.fieldObjectiveStatus(s, f).met, `${id} forced objective should be met`);
  const result = G.completeField(s);
  assert(result.ok, `${id} should clear`);
  return result;
}

// Fresh Field era branches across all five Tier-I contexts.
{
  const s = entryState();
  assert.deepStrictEqual(G.availableFields(s).map(f => f.id), ['urban','remote','oral','restricted','multilingual']);
  assert.strictEqual(G.fieldClearCounts(s).total, 0);
  assert.strictEqual(G.fieldMasteryStatus(s).tier1.mastered, false);
}

// Any three Tier-I clears open Tier II, but each Tier-II route requires its matching Tier-I predecessor.
{
  const s = entryState();
  forceClear(s, 'oral'); forceClear(s, 'restricted'); forceClear(s, 'multilingual');
  const ids = G.availableFields(s).map(f => f.id);
  assert(ids.includes('urban') && ids.includes('remote'));
  assert(ids.includes('multilingual-ii'), 'Multilingual II should open through its cleared Tier-I parent');
  assert(!ids.includes('urban-ii'), 'Urban II must require Urban I');
  assert(!ids.includes('remote-ii'), 'Remote II must require Remote I');
  assert.strictEqual(G.fieldClearCounts(s).tier1, 3);
}

// Two Tier-II clears open Frontier III before all optional Fields are complete.
{
  const s = entryState();
  for (const id of ['urban','remote','multilingual']) forceClear(s, id);
  forceClear(s, 'urban-ii'); forceClear(s, 'remote-ii');
  assert(G.availableFields(s).some(f => f.id === 'frontier-iii'), 'Frontier III should open after any two Tier-II clears');
  assert(G.fieldClearCounts(s).total < G.FIELDS.length, 'Frontier should be reachable before full canonical mastery');
}

// Cleared Fields cannot be entered twice and full mastery unlocks Mature Fields.
{
  const s = entryState();
  for (const id of ['urban','remote','oral','restricted','multilingual','urban-ii','remote-ii','multilingual-ii','frontier-iii']) forceClear(s, id);
  assert.strictEqual(G.fieldMasteryStatus(s).canonical.mastered, true);
  assert.strictEqual(G.canEnterField(s, 'urban'), false);
  s.ncThisField = G.bn(1);
  assert(G.availableFields(s).some(f => f.id === 'mature-field'));
}

// v1.9 linear Field saves migrate deterministically into explicit cleared IDs.
{
  const raw = JSON.parse(G.serializeState(G.createState()));
  raw.field.index = 4;
  delete raw.field.cleared;
  delete raw.field.activeId;
  raw.campaign.tier1 = 4;
  const s = G.reviveState(raw);
  assert.deepStrictEqual(s.field.cleared, ['urban','remote','oral','restricted']);
  assert.strictEqual(s.field.index, 4);
  assert.strictEqual(s.campaign.tier1, 4);
}

// Active legacy saves migrate to the old sequential active Field.
{
  const raw = JSON.parse(G.serializeState(G.createState()));
  raw.field.index = 5;
  raw.field.active = true;
  delete raw.field.cleared;
  delete raw.field.activeId;
  const s = G.reviveState(raw);
  assert.strictEqual(G.currentField(s).id, 'urban-ii');
}

// Field-depth helpers are non-mutating and provide route/bottleneck/debrief models.
{
  // serializeState adds Date.now(); freeze only this assertion's clock so a
  // millisecond boundary cannot masquerade as a mutation of game state.
  const realNow = Date.now, fixedNow = realNow();
  Date.now = () => fixedNow;
  try {
  const s = entryState();
  const before = G.serializeState(s);
  const route = F.routeState(s, G);
  assert.strictEqual(route.available.length, 5);
  assert(route.nextUnlock.includes('Tier I'));
  assert.strictEqual(G.serializeState(s), before);
  assert.strictEqual(F.strategyFor(G.FIELDS[2]).emphasis, 'Teachers + Projects');
  } finally { Date.now = realNow; }
}

// Atlas exposes multiple available route nodes rather than a single linear next node.
{
  const s = entryState();
  s.translations = 10; s.tiOneTime.translationAutomation = true; s.networks = 8; s.phase3Complete = true;
  const model = A.getAtlasModel(s, G);
  const available = model.fields.filter(f => f.status === 'available' || f.status === 'next');
  assert.strictEqual(available.length, 5);
}

// Curated route styles remain viable and none becomes a dominant route.
{
  const modes = ['canonical','frontier-fast','retention-first','distribution-first','hard-first'];
  const rows = modes.map(mode => simulateCampaign(G, { ...BASE_STRATEGY, name:`route-${mode}`, fieldRouteMode:mode, maxDays:20 }).metrics);
  for (const m of rows) assert(Number.isFinite(m.completeDays) && m.completeDays >= 7 && m.completeDays <= 17, `${m.name} outside viable route envelope: ${m.completeDays}`);
  const times = rows.map(r => r.completeDays);
  assert(Math.max(...times) / Math.min(...times) <= 1.25, 'Curated route spread exceeds 1.25x');
}

// Shipping surface contains the route planner, briefing/debrief, module and offline cache entry.
{
  const html = fs.readFileSync('index.html','utf8');
  const app = fs.readFileSync('app.js','utf8');
  const css = fs.readFileSync('styles.css','utf8');
  const sw = fs.readFileSync('sw.js','utf8');
  assert(html.includes('id="fieldRouteBoard"'));
  assert(html.includes('id="fieldStrategyBriefing"'));
  assert(html.includes('id="fieldDebrief"'));
  assert(html.includes('<script src="field-depth.js"></script>'));
  assert(app.includes('data-enter-field'));
  assert(css.includes('.field-route-board'));
  assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['field-depth.js']), 'module must be included in the cached document');
}

console.log('Pristine Phase 10 Mission Fields: PASS · branching routes · parent dependencies · mastery tools · debriefs · migration · route balance');
