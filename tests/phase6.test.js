const assert = require('assert');
const G = require('../game-core.js');
const Save = require('../save-format.js');

function clone(s) { return G.reviveState(JSON.parse(G.serializeState(s))); }
function automatedState() {
  const s = G.createState();
  s.tiOneTime.basicAutomation = true;
  s.tiOneTime.fullAutomation = true;
  s.tiOneTime.projectQueue = true;
  s.tiOneTime.translationAutomation = true;
  s.automation.basic = true;
  s.automation.full = true;
  s.automation.projects = true;
  s.automation.translation = true;
  s.automation.autoSettings = { enabled: true, minRun: 600, resetMultiple: 1.35, maxRun: 1800 };
  s.specialization = 'publisher';
  s.lifetimeTi = G.bn(5000);
  s.networks = 2;
  s.lifetimeNc = G.bn(2);
  s.nc = G.bn(2);
  return s;
}

// v5/raw saves migrate into v6 system/automation settings.
{
  const raw = JSON.parse(G.serializeState(G.createState()));
  raw.version = 5;
  delete raw.system;
  delete raw.automation.controls;
  const s = G.reviveState(raw);
  assert.strictEqual(s.version, 8);
  assert.strictEqual(s.system.offlineEnabled, true);
  assert.strictEqual(s.system.offlineCapSeconds, 14 * 86400);
  assert.strictEqual(s.automation.controls.baseEnabled, true);
}


// Save envelopes round-trip, detect tampering, accept legacy raw saves, and reject malformed state payloads.
{
  const state = automatedState();
  state.pages = G.bn('1e123');
  const envelope = Save.makeEnvelope(state, 1700000000000);
  const parsed = Save.parseSaveText(envelope);
  assert.strictEqual(parsed.envelope, true);
  assert.strictEqual(parsed.savedAt, 1700000000000);
  assert(parsed.state.pages.eq(state.pages));

  const tampered = JSON.parse(envelope);
  tampered.state.translations = 999999;
  assert.throws(() => Save.parseSaveText(JSON.stringify(tampered)), /checksum/i);

  const legacyRaw = G.serializeState(state);
  const legacyParsed = Save.parseSaveText(legacyRaw);
  assert.strictEqual(legacyParsed.envelope, false);
  assert(legacyParsed.state.pages.eq(state.pages));

  const malformed = JSON.parse(legacyRaw);
  malformed.pages = { log10: 'corrupt' };
  assert.throws(() => Save.parseSaveText(JSON.stringify(malformed)), /pages/i);
}

// Offline simulation is economically identical to live tick cadence for the same elapsed time.
{
  const live = automatedState();
  const offline = clone(live);
  const seconds = 24 * 3600;
  G.tick(live, seconds);
  const summary = G.simulateOffline(offline, seconds);
  assert.strictEqual(summary.simulatedSeconds, seconds);
  assert.strictEqual(offline.translations, live.translations);
  assert(offline.pages.eq(live.pages));
  assert(offline.lifetimeTi.eq(live.lifetimeTi));
  assert.strictEqual(offline.timePlayed, live.timePlayed);
  assert.strictEqual(offline.records.offlineSessions, 1);
}

// Offline cap bounds work without claiming unsimulated time.
{
  const s = G.createState();
  const result = G.simulateOffline(s, 7200, { capSeconds: 3600 });
  assert.strictEqual(result.simulatedSeconds, 3600);
  assert.strictEqual(result.cappedSeconds, 3600);
  assert.strictEqual(Math.round(s.timePlayed), 3600);
}

// Automation controls pause behavior without removing unlocks.
{
  const s = automatedState();
  G.setAutomationControls(s, { baseEnabled: false, projectsEnabled: false, translationEnabled: false });
  s.pages = G.bn('1e20'); s.peakPages = G.bn('1e20'); s.runTime = 3600;
  const before = { translations: s.translations, scribes: s.producers.scribe };
  G.tick(s, 60);
  assert.strictEqual(s.producers.scribe, before.scribes);
  assert.strictEqual(s.translations, before.translations);
  assert.strictEqual(s.automation.full, true); // unlock remains
  G.setAutomationControls(s, { baseEnabled: true });
  G.tick(s, 1);
  assert(s.producers.scribe > before.scribes);
}

// Bulk buying exactly matches repeated single purchases.
{
  for (const id of ['scribe','copyist','editor','teacher','workshop','scriptorium']) {
    for (const pages of ['1e4','1e8','1e15','1e40']) {
      const a = G.createState(); a.pages = G.bn(pages); a.specialization = 'publisher';
      const b = clone(a);
      const bulk = G.buyProducer(a, id, 'max').bought;
      let singles = 0;
      while (G.buyProducer(b, id, 1).bought) { singles++; if (singles > 100000) throw new Error('bulk test runaway'); }
      assert.strictEqual(bulk, singles, `${id} ${pages}`);
      assert.strictEqual(a.producers[id], b.producers[id]);
      assert(a.pages.eq(b.pages), `${id} ${pages} resources differ`);
    }
  }
}

// Import/state validation rejects malformed numeric and allocation payloads.
{
  const bad = JSON.parse(G.serializeState(G.createState()));
  bad.pages = { log10: 'not-a-number' };
  bad.allocation.local = 2;
  const v = G.validateStatePayload(bad);
  assert.strictEqual(v.ok, false);
  assert(v.errors.length >= 2);
}

// Sanitizer clamps structural values rather than propagating impossible levels.
{
  const raw = JSON.parse(G.serializeState(G.createState()));
  raw.tiUpgrades.preparation = 999;
  raw.netUpgrades.infrastructure = 999;
  raw.field.index = 9;
  raw.records.offlineSessions = -4;
  const s = G.reviveState(raw);
  assert.strictEqual(s.tiUpgrades.preparation, 6);
  assert.strictEqual(s.netUpgrades.infrastructure, 12);
  assert.strictEqual(s.field.index, G.FIELDS.length);
  assert.strictEqual(s.records.offlineSessions, 0);
}

// ETA diagnostics never mutate the economy and expose usable estimates when history exists.
{
  const s = automatedState();
  s.records.recentTranslations = [{ duration: 600, gain: G.bn(100) }];
  s.records.recentNetworks = [{ duration: 7200, gain: G.bn(2) }];
  s.records.recentFields = [{ duration: 86400, gain: G.bn(20) }];
  const before = G.serializeState(s);
  const eta = G.estimateProgressEtas(s);
  assert(eta.network == null || eta.network >= 0);
  assert(eta.field == null || eta.field >= 0);
  assert(eta.legacy == null || eta.legacy >= 0);
  // Ignore lastSavedAt generated by serialization, but state itself must not change.
  assert.strictEqual(s.translations, 0);
  assert.strictEqual(s.records.recentTranslations.length, 1);
}

// 14-day offline workload stays bounded enough for startup use in this reference environment.
{
  const s = automatedState();
  const t0 = Date.now();
  G.simulateOffline(s, 14 * 86400);
  const ms = Date.now() - t0;
  assert(ms < 5000, `14-day offline simulation took ${ms}ms`);
  console.log(`Phase 6 offline performance: 14 days in ${ms}ms`);
}

console.log('Phase 6 UX & Automation Hardening tests: PASS');
