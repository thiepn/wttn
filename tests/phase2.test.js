const assert = require('assert');
const G = require('../game-core.js');

function approx(actual, expected, eps = 1e-9) { assert(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`); }

// Core v0.2 Translation formula remains authoritative.
{
  const s = G.createState();
  s.peakPages = G.bn('1e12');
  assert(G.translationGain(s).eq(1));
  s.peakPages = G.bn('6.095558e13');
  approx(G.translationGain(s).toNumber(), 14, 1e-9);
}

// Workflow, Training, and Preparation have distinct, inspectable effects.
{
  const s = G.createState();
  s.producers.scribe = 100; s.producers.copyist = 100;
  const p0 = G.pageProduction(s).toNumber();
  s.ti = G.bn(1000);
  assert(G.buyTiRepeatable(s, 'workflow'));
  const p1 = G.pageProduction(s).toNumber();
  assert(p1 > p0 * 1.4 && p1 < p0 * 1.5);
  const e0 = G.synergyExponent(s, 'scribe');
  assert(G.buyTiRepeatable(s, 'training'));
  assert(G.synergyExponent(s, 'scribe') > e0);
  for (let i = 0; i < 3; i++) assert(G.buyTiRepeatable(s, 'preparation'));
  G.resetBase(s);
  assert.strictEqual(s.producers.scribe, 10);
  assert.strictEqual(s.producers.copyist, 10);
  assert.strictEqual(s.pageUpgrades.desk, 1);
  assert.strictEqual(s.pageUpgrades.copying, 1);
}

// Specializations follow the certified v0.2 mechanics.
{
  const pub = G.createState();
  pub.lifetimeTi = G.bn(100); pub.specialization = 'publisher';
  const normalCost = G.rawProducerCost(G.PRODUCERS[0], 0).toNumber();
  const pubCost = G.producerCost(G.PRODUCERS[0], 0, pub).toNumber();
  approx(pubCost / normalCost, 0.675, 1e-10);

  const teacher = G.createState();
  teacher.lifetimeTi = G.bn(100); teacher.specialization = 'teacher';
  assert(G.milestoneMultiplier(10, teacher) > G.milestoneMultiplier(10, G.createState()));
  assert(G.projectThreshold(teacher, 'manuscript').eq(G.bn('8e5')));

  const scholar = G.createState();
  scholar.lifetimeTi = G.bn(100); scholar.specialization = 'scholar'; scholar.runTime = 1800;
  assert(G.scholarMultiplier(scholar) > 1.3 && G.scholarMultiplier(scholar) < 1.5);
}

// One-time path is ordered and unlocks non-redundant automation stages.
{
  const s = G.createState(); s.ti = G.bn(10000); s.lifetimeTi = G.bn(10000);
  assert(G.hasBuyMax(s)); assert(!G.buyTiOneTime(s, 'buyMax')); // Free convenience is not a paid upgrade.
  for (const id of ['standardTerminology','reusableTemplates','consistentWorkflow','basicAutomation']) assert(G.buyTiOneTime(s, id));
  assert(s.automation.basic && !s.automation.full);
  assert(G.buyTiOneTime(s, 'fullAutomation'));
  assert(s.automation.full);
}

// Basic automation handles only the early chain; full automation handles the entire base layer.
{
  const s = G.createState(); s.pages = G.bn('1e30'); s.peakPages = s.pages.clone();
  s.automation.basic = true;
  G.runAutomation(s);
  assert(s.producers.scribe > 0 && s.producers.copyist > 0);
  assert.strictEqual(s.producers.editor, 0);
  s.automation.full = true;
  G.runAutomation(s);
  assert(s.producers.editor > 0 && s.producers.scriptorium > 0);
}

// Basic Automation must never consume Pages that already make the next stronger building affordable.
{
  const s = G.createState();
  s.automation.basic = true;
  s.pageUpgrades.desk = 1; s.pageUpgrades.copying = 1;
  s.producers.scribe = 9; s.producers.copyist = 9;
  const editor = G.PRODUCERS.find(x => x.id === 'editor');
  const reserve = G.producerCost(editor, 0, s);
  s.pages = reserve.clone(); s.peakPages = reserve.clone();
  G.runAutomation(s);
  assert(s.pages.gte(reserve), 'Basic Automation spent the Editor reserve');
  assert.strictEqual(s.producers.scribe, 9);
  assert.strictEqual(s.producers.copyist, 9);
}

// Below the reserve, Basic Automation may seed the early chain but may not buy-max it.
{
  const s = G.createState();
  s.automation.basic = true;
  s.pageUpgrades.desk = 1; s.pageUpgrades.copying = 1;
  s.pages = G.bn('9000'); s.peakPages = s.pages.clone();
  G.runAutomation(s);
  assert(s.producers.scribe > 0 && s.producers.scribe <= 3);
  assert(s.producers.copyist > 0 && s.producers.copyist <= 3);
  assert(s.pages.gt(0), 'Basic Automation drained the entire Page balance');
}

// Presets preserve reset configuration and specialization intent.
{
  const s = G.createState(); s.lifetimeTi = G.bn(1000); s.tiOneTime.presets = true; s.specialization = 'publisher';
  G.setAutoSettings(s, { minRun: 240, resetMultiple: 1.8, maxRun: 1500 });
  assert(G.savePreset(s, 1));
  G.setAutoSettings(s, { minRun: 90, resetMultiple: 1.1, maxRun: 300 });
  G.setSpecialization(s, 'scholar', { forNextRun: true });
  assert(G.loadPreset(s, 1));
  assert.strictEqual(s.automation.autoSettings.minRun, 240);
  assert.strictEqual(s.queuedSpecialization, 'publisher');
}

// Phase 1 saves migrate and continue instead of freezing after the first Translation.
{
  const old = { version: 1, ti: { log10: 1 }, translations: 1, phase1Complete: true, pages: { zero: true }, peakPages: { zero: true } };
  const s = G.reviveState(old);
  assert.strictEqual(s.version, 8);
  assert(s.ti.eq(10)); assert(s.lifetimeTi.eq(10));
  G.tick(s, 1);
  assert(s.timePlayed >= 1);
}


// Auto-Translation uses the same gain/readiness rules and performs a real reset.
{
  const s = G.createState();
  s.translations = 1; s.automation.translation = true; s.automation.autoSettings = { enabled: true, minRun: 60, resetMultiple: 1, maxRun: 600 };
  s.pages = G.bn('1e15'); s.peakPages = G.bn('1e15'); s.runTime = 600; s.records.lastTranslationGain = G.bn(1);
  const before = s.translations;
  G.tick(s, 10);
  assert.strictEqual(s.translations, before + 1);
  assert(s.pages.lt('1e12'));
}

function manualAct(s) {
  // First-ever specialization may be selected immediately when it unlocks.
  if (G.specializationUnlocked(s) && !s.specialization) G.setSpecialization(s, 'publisher');

  // Mirror v0.2 one-time-first TI policy.
  for (const def of G.TI_ONE_TIMES) {
    if (!s.tiOneTime[def.id]) {
      if (G.oneTimeAvailable(s, def.id) && s.ti.gte(def.cost)) return G.buyTiOneTime(s, def.id);
      break;
    }
  }
  for (const id of ['workflow','training','preparation']) {
    const cost = G.repeatableCost(s, id);
    if (cost && s.ti.gte(cost)) return G.buyTiRepeatable(s, id);
  }

  for (const p of G.PROJECTS) if (G.projectStatus(s, p.id).available && !s.projects[p.id]) return G.completeProject(s, p.id);
  for (const u of G.PAGE_UPGRADES) if (!s.pageUpgrades[u.id] && s.pages.gte(u.cost)) return G.buyPageUpgrade(s, u.id);
  for (const p of [...G.PRODUCERS].reverse()) if (G.maxAffordableProducerCount(s, p.id, 10000) > 0) { G.buyProducer(s, p.id, 'max'); return true; }
  return false;
}

function shouldManualTranslate(s) {
  const gain = G.translationGain(s);
  if (gain.lt(1)) return false;
  if (s.translations === 0) return s.runTime >= 35 * 60;
  if (s.runTime < 4 * 60) return false;
  const last = s.records.lastTranslationGain;
  return last.isZero || gain.gte(last.mul(1.5)) || s.runTime >= 35 * 60;
}

// Six-hour-ish Translation-layer regression: the full automation endpoint must remain inside v0.2's 2–7h gate.
{
  const s = G.createState();
  let nextDecision = 0;
  const maxTime = 7 * 3600;
  while (s.timePlayed < maxTime && !s.tiOneTime.translationAutomation) {
    if (s.timePlayed + 1e-9 >= nextDecision) {
      let loops = 0;
      while (loops++ < 160 && manualAct(s)) {}
      if (!s.automation.translation && shouldManualTranslate(s)) G.completeTranslation(s, false);
      nextDecision = s.timePlayed + (s.timePlayed < 2 * 3600 ? 15 : 5 * 60);
    }
    G.tick(s, 1);
  }
  assert(s.tiOneTime.translationAutomation, `Translation Automation not reached by 7h; lifetime TI=${s.lifetimeTi.format(3)}, translations=${s.translations}`);
  assert(s.records.translationAutomationAt >= 2 * 3600, `Automation too early at ${s.records.translationAutomationAt/3600}h`);
  assert(s.records.translationAutomationAt <= 7 * 3600, `Automation too late at ${s.records.translationAutomationAt/3600}h`);
  assert(G.specializationUnlocked(s));
  assert(s.translations >= 5);
  console.log(`Phase 2 reference: Translation Automation at ${(s.records.translationAutomationAt/3600).toFixed(2)}h; translations=${s.translations}; lifetime TI=${s.lifetimeTi.format(3)}; Workflow L${s.tiUpgrades.workflow}; Training L${s.tiUpgrades.training}; Preparation L${s.tiUpgrades.preparation}`);
}

console.log('Phase 2 core tests: PASS');
