'use strict';
const assert = require('assert');
const G = require('../game-core.js');
const Save = require('../save-format.js');
const { simulateCampaign } = require('./phase9-sim-lib.js');

function between(x, lo, hi, label) {
  assert(Number.isFinite(x) && x >= lo && x <= hi, `${label}: ${x} outside ${lo}–${hi}`);
}

// Repeat Legacy readiness must not alter the first Legacy denomination, but must
// compress repeat resets that arrive far earlier than the intended 30-hour window.
{
  const first = G.createState(); first.feThisLegacy = G.bn(70);
  assert(Math.abs(G.legacyGain(first).toNumber() - 15) < 1e-9);
  assert.strictEqual(G.legacyReadiness(first).factor, 1);

  const early = G.createState(); early.legacies = 1; early.lifetimeLegacy = G.bn(15); early.feThisLegacy = G.bn(70); early.legacyRunTime = 7.5 * 3600;
  assert.strictEqual(G.legacyReadiness(early).status, 'early');
  assert(Math.abs(G.legacyReadiness(early).factor - 0.25) < 1e-12);
  assert(Math.abs(G.legacyGain(early).toNumber() - 3) < 1e-9);

  const mature = G.createState(); mature.legacies = 1; mature.lifetimeLegacy = G.bn(15); mature.feThisLegacy = G.bn(70); mature.legacyRunTime = G.LEGACY_READINESS_TARGET_SECONDS;
  assert.strictEqual(G.legacyReadiness(mature).factor, 1);
  assert(Math.abs(G.legacyGain(mature).toNumber() - 15) < 1e-9);
}

const craftedExploit = {
  name: 'crafted-optimizer', decisionSeconds: 60,
  specialization: 'scholar', tradition: 'distribution', firstTranslationSeconds: 30 * 60,
  networkMinSeconds: 30 * 60, networkMultiple: 1.3, networkMaxSeconds: 2 * 3600,
  legacyMinSeconds: 8 * 3600, legacyMultiple: 1.1, legacyMaxSeconds: 12 * 3600,
  tiOrder: 'repeatables-first', networkOrder: 'one-time-first', producerOrder: 'high-tier-first', allocationMode: 'optimized'
};

const cases = [
  { cfg: { name:'normal' }, range:[7,14.5] },
  { cfg: { name:'active', decisionSeconds:60 }, range:[7,14.5] },
  { cfg: craftedExploit, range:[7,12] },
  { cfg: { name:'casual-after-2h', decisionSeconds:1800 }, range:[10,22] },
  { cfg: { name:'repeatables-first', tiOrder:'repeatables-first' }, range:[7,15] },
];

const results = [];
for (const {cfg, range} of cases) {
  const run = simulateCampaign(G, cfg);
  const m = run.metrics;
  between(m.completeDays, range[0], range[1], `${cfg.name} completion days`);
  assert(run.state.campaign.complete, `${cfg.name}: campaign did not complete`);
  assert(m.fastestTranslation == null || m.fastestTranslation >= 90, `${cfg.name}: Translation collapsed to ${m.fastestTranslation}s`);
  assert(m.fastestNetwork == null || m.fastestNetwork >= 300, `${cfg.name}: Network collapsed to ${m.fastestNetwork}s`);
  assert(m.lifetimeLegacy >= 100 - 1e-8, `${cfg.name}: final Legacy target missing`);
  assert.strictEqual(run.state.campaign.tier1, 5, `${cfg.name}: Tier I Field count`);
  assert.strictEqual(run.state.campaign.tier2, 3, `${cfg.name}: Tier II Field count`);
  assert.strictEqual(run.state.campaign.tier3, 1, `${cfg.name}: Tier III Field count`);
  const canonical = m.fieldClears.filter(f => f.id !== 'mature-field').map(f => f.id);
  assert.deepStrictEqual(canonical, G.FIELDS.map(f => f.id), `${cfg.name}: canonical Field order/fidelity`);
  assert(m.fieldClears.every(f => f.objectiveMet), `${cfg.name}: Field cleared without objective`);
  results.push(run);
}

// Save/export fidelity at late-game checkpoints from the actual full campaign.
{
  const normal = results[0];
  for (const key of ['first-network','first-field','first-legacy','all-canonical-fields','campaign-complete']) {
    const raw = normal.metrics.checkpoints[key];
    assert(raw, `missing checkpoint ${key}`);
    const revived = G.reviveState(JSON.parse(raw));
    const envelope = Save.makeEnvelope(revived, 1700000000000);
    const parsed = Save.parseSaveText(envelope).state;
    assert.strictEqual(parsed.field.index, revived.field.index, `${key}: Field index drift`);
    assert.strictEqual(parsed.legacies, revived.legacies, `${key}: Legacy count drift`);
    assert(parsed.lifetimeLegacy.eq(revived.lifetimeLegacy), `${key}: Legacy currency drift`);
    assert(parsed.lifetimeFe.eq(revived.lifetimeFe), `${key}: FE drift`);
    assert.strictEqual(parsed.campaign.complete, revived.campaign.complete, `${key}: campaign state drift`);
  }
}

console.log('Phase 9 strategy certification:');
for (const r of results) {
  const m = r.metrics;
  console.log(`  ${m.name.padEnd(20)} ${m.completeDays.toFixed(3)}d · first N ${m.firstNetworkHours.toFixed(2)}h · first F ${m.firstFieldHours.toFixed(2)}h · first L ${m.firstLegacyDays.toFixed(2)}d · fastest T ${m.fastestTranslation}s · fastest N ${m.fastestNetwork}s`);
}
console.log('Phase 9 Full Balance Regression tests: PASS');
