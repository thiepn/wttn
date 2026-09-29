const assert = require('assert');
const G = require('../game-core.js');

function approx(actual, expected, eps = 1e-8) {
  assert(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`);
}

// Phase 3 saves migrate without inventing Field or Legacy progress.
{
  const raw = JSON.parse(G.serializeState(G.createState()));
  raw.version = 3;
  delete raw.fe; delete raw.lifetimeFe; delete raw.feThisLegacy; delete raw.field; delete raw.fieldRewards; delete raw.campaign;
  const s = G.reviveState(raw);
  assert.strictEqual(s.version, 8);
  assert(s.fe.eq(0) && s.lifetimeFe.eq(0) && s.feThisLegacy.eq(0));
  assert.strictEqual(s.field.index, 0);
  assert.strictEqual(s.field.active, false);
}

// All nine certified Field rule sets are present in order.
{
  assert.deepStrictEqual(G.FIELDS.map(x => x.id), [
    'urban','remote','oral','restricted','multilingual','urban-ii','remote-ii','multilingual-ii','frontier-iii'
  ]);
  assert.deepStrictEqual(G.FIELDS.map(x => x.tier), [1,1,1,1,1,2,2,2,3]);
}

// Urban Hub I enforces balanced allocation.
{
  const s = G.createState();
  s.lifetimeNc = G.bn(6); s.ncThisField = G.bn(1); s.phase3Complete = true;
  assert(G.enterField(s).ok);
  assert.strictEqual(G.currentField(s).id, 'urban');
  approx(G.allocationLimits(s).cap, .4);
  assert(!G.setAllocation(s, { local:.5, regional:.2, international:.2, digital:.1 }));
  assert(G.setAllocation(s, { local:.25, regional:.25, international:.25, digital:.25 }));
}

// Remote Region I applies its production and Local-cap constraints.
{
  const base = G.createState(); base.producers.scribe = 100;
  const p0 = G.pageProduction(base).toNumber();
  const s = G.createState(); s.field.active = true; s.field.index = 1; s.producers.scribe = 100;
  const p1 = G.pageProduction(s).toNumber();
  assert(p1 < p0 * .61 && p1 > p0 * .59);
  approx(G.allocationLimits(s).localCap, .2);
}

// Oral Tradition shifts power toward Teachers and Projects instead of raw producers.
{
  const base = G.createState(); base.producers.teacher = 20;
  const p0 = G.pageProduction(base).toNumber();
  const s = G.createState(); s.field.active = true; s.field.index = 2; s.producers.teacher = 20;
  const p1 = G.pageProduction(s).toNumber();
  assert(p1 > p0 * 1.35 && p1 < p0 * 1.45, `oral teacher ratio ${(p1/p0).toFixed(3)}`);
  base.projects.manuscript = true; s.projects.manuscript = true;
  const baseProject = G.pageProduction(base).toNumber();
  const fieldProject = G.pageProduction(s).toNumber();
  assert(fieldProject / p1 > baseProject / p0, 'Oral Project effect was not strengthened');
}

// Restricted Context gates automatic Translation, not manual Translation itself.
{
  const s = G.createState(); s.field.active = true; s.field.index = 3; s.automation.translation = true;
  s.tiThisNetwork = G.bn(999);
  assert(!G.autoTranslationAllowed(s));
  s.tiThisNetwork = G.bn(1000);
  assert(G.autoTranslationAllowed(s));
}

// Multilingual Fields alter Translation thresholds/TI rules without changing the base formula elsewhere.
{
  const s = G.createState(); s.field.active = true; s.field.index = 4;
  assert(G.translationThreshold(s).eq(G.TRANSLATION_THRESHOLD.mul(10)));
  const s2 = G.createState(); s2.field.active = true; s2.field.index = 7;
  assert(G.translationThreshold(s2).eq(G.TRANSLATION_THRESHOLD.mul(25)));
  approx(G.allocationLimits(s2).internationalCap, .4);
}

// Tier II and III constraints are concrete, not labels.
{
  const urban2 = G.createState(); urban2.field.active = true; urban2.field.index = 5;
  approx(G.allocationLimits(urban2).cap, .4); approx(G.allocationLimits(urban2).digitalMin, .2);
  const remote2 = G.createState(); remote2.field.active = true; remote2.field.index = 6; remote2.tiUpgrades.preparation = 6;
  assert.strictEqual(G.effectivePreparationLevel(remote2), 3);
  approx(G.allocationLimits(remote2).localCap, .1);
  const frontier = G.createState(); frontier.field.active = true; frontier.field.index = 8; frontier.tiUpgrades.preparation = 6;
  assert.strictEqual(G.effectivePreparationLevel(frontier), 2);
  assert(!G.fieldObjectiveStatus(frontier).met);
  frontier.field.progressNc = G.bn(35); frontier.field.stats.validNetworks = 3; frontier.field.stats.translations = 8; frontier.field.stats.projects = ['manuscript','reference','teaching'];
  assert(G.fieldObjectiveStatus(frontier).met);
}

// A Field clear awards FE and its intended permanent rule change.
{
  const s = G.createState();
  s.lifetimeNc = G.bn(6); s.ncThisField = G.bn(1); s.phase3Complete = true;
  G.enterField(s);
  s.field.progressNc = G.bn(2); s.field.stats.validNetworks = 1;
  const gain = G.fieldReward(s);
  assert(gain.eq(25), `expected 25 FE, got ${gain.format(4)}`);
  const result = G.completeField(s);
  assert(result.ok && result.gain.eq(25));
  assert.strictEqual(s.field.index, 1);
  assert(s.fe.eq(25) && s.feThisLegacy.eq(25));
  approx(s.fieldRewards.allocationCap, .75);
  assert.strictEqual(s.field.active, false);
}

// Field rewards stop growing once the objective is complete; excess NC cannot be farmed for extra FE.
{
  const a = G.createState(); a.field.active = true; a.field.index = 0; a.field.progressNc = G.bn(2); a.field.stats.validNetworks = 1;
  const b = G.createState(); b.field.active = true; b.field.index = 0; b.field.progressNc = G.bn(2000); b.field.stats.validNetworks = 1;
  assert(G.fieldReward(a).eq(G.fieldReward(b)));
}

function simulateReference() {
  const s = G.createState();
  let nextDecision = 0;

  function chooseAllocation() {
    const field = G.currentField(s);
    if (field) {
      const base = G.recommendedFieldAllocation(field);
      const candidates = s.networkRunTime < 20 * 60
        ? [{local:.4,regional:.25,international:.15,digital:.2},{local:.2,regional:.35,international:.25,digital:.2},base]
        : Object.values(s.projects).some(v => !v)
          ? [{local:.1,regional:.3,international:.2,digital:.4},{local:.2,regional:.25,international:.2,digital:.35},base]
          : [{local:.1,regional:.35,international:.4,digital:.15},{local:.2,regional:.3,international:.35,digital:.15},base];
      for (const a of candidates) if (G.setAllocation(s, a)) return;
      G.setAllocation(s, base); return;
    }
    if (s.networks === 0) return;
    if (s.networkRunTime < 20 * 60 || s.peakPages.lt('1e9')) G.setAllocation(s, { local:.5, regional:.3, international:.1, digital:.1 });
    else if (Object.values(s.projects).some(v => !v)) G.setAllocation(s, { local:.2, regional:.3, international:.2, digital:.3 });
    else G.setAllocation(s, { local:.1, regional:.4, international:.4, digital:.1 });
  }

  function buyNetworkDevelopment() {
    const infra = G.networkUpgradeCost(s, 'infrastructure');
    if (infra && s.nc.gte(infra)) return G.buyNetworkUpgrade(s, 'infrastructure');
    for (const def of G.NETWORK_UPGRADES.filter(x => !x.repeatable)) {
      const cost = G.networkUpgradeCost(s, def.id);
      if (cost && s.nc.gte(cost)) return G.buyNetworkUpgrade(s, def.id);
    }
    return false;
  }

  function act() {
    if (s.automation.basic && s.automation.controls?.baseEnabled === false) { G.setAutomationControls(s, { baseEnabled: true }); return true; }
    if (s.automation.projects && s.automation.controls?.projectsEnabled === false) { G.setAutomationControls(s, { projectsEnabled: true }); return true; }
    if (s.automation.translation && s.automation.controls?.translationEnabled === false) { G.setAutomationControls(s, { translationEnabled: true }); return true; }
    if (G.specializationUnlocked(s) && !s.specialization) G.setSpecialization(s, 'publisher');
    chooseAllocation();
    if (buyNetworkDevelopment()) return true;
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
    for (const p of [...G.PRODUCERS].reverse()) {
      if (G.maxAffordableProducerCount(s, p.id, 10000) > 0) { G.buyProducer(s, p.id, 'max'); return true; }
    }
    return false;
  }

  function shouldTranslate() {
    const gain = G.translationGain(s);
    if (gain.lt(1)) return false;
    if (s.translations === 0) return s.runTime >= 35 * 60;
    const min = s.lifetimeNc.gt(0) ? 10 * 60 : 4 * 60;
    if (s.runTime < min) return false;
    const last = s.records.lastTranslationGain;
    return last.isZero || gain.gte(last.mul(1.5)) || s.runTime >= (s.lifetimeNc.gt(0) ? 45 * 60 : 35 * 60);
  }

  function shouldNetwork() {
    const gain = G.networkGain(s);
    if (gain.lt(1)) return false;
    if (s.networks === 0) return true;
    if (s.networkRunTime < 60 * 60) return false;
    const last = s.records.recentNetworks[0]?.gain || G.bn(0);
    return last.isZero || gain.gte(last.mul(1.5)) || s.networkRunTime >= 4 * 3600;
  }

  const max = 6 * 86400;
  while (s.timePlayed < max && !G.legacyReady(s)) {
    if (s.timePlayed + 1e-9 >= nextDecision) {
      let loops = 0;
      while (loops++ < 500 && act()) {}
      if (s.field.active && G.fieldReward(s).gte(1)) G.completeField(s);
      else if (!s.field.active && G.canEnterField(s)) G.enterField(s);
      else if (shouldNetwork()) G.completeNetwork(s);
      else if ((!s.automation.translation || !G.autoTranslationAllowed(s)) && shouldTranslate()) G.completeTranslation(s, false);
      nextDecision = s.timePlayed + (s.timePlayed < 2 * 3600 ? 15 : 5 * 60);
    }
    G.tick(s, 1);
  }
  return s;
}

// Full Phase 4 progression regression.
{
  const s = simulateReference();
  const firstFieldH = s.records.firstFieldAt / 3600;
  const firstClearH = s.records.firstFieldClearAt / 3600;
  const legacyD = s.records.legacyReadyAt / 86400;
  assert(firstFieldH >= 18 && firstFieldH <= 30, `first Field ${firstFieldH.toFixed(2)}h outside 18–30h`);
  assert(firstClearH >= 24 && firstClearH <= 40, `first Field clear ${firstClearH.toFixed(2)}h outside 24–40h`);
  assert(s.records.recentFields.length >= 3, `only ${s.records.recentFields.length} Fields cleared before Legacy readiness`);
  const chronologicalFields = [...s.records.recentFields].sort((a,b) => a.at - b.at);
  const thirdClearD = chronologicalFields[2]?.at / 86400;
  assert(thirdClearD >= 2 && thirdClearD <= 4, `third Field clear ${thirdClearD.toFixed(2)}d outside 2–4d`);
  assert(G.legacyReady(s), 'Legacy did not become ready by 6 days');
  assert(legacyD >= 2 && legacyD <= 4, `Legacy ready ${legacyD.toFixed(2)}d outside 2–4d`);
  assert(s.records.fastestNetwork >= 300, `Network reset collapsed to ${s.records.fastestNetwork}s`);
  assert(s.field.index >= 3, `expected at least three Field clears, got ${s.field.index}`);
  console.log(`Phase 4 reference: first Field ${firstFieldH.toFixed(2)}h; first clear ${firstClearH.toFixed(2)}h; third clear ${thirdClearD.toFixed(2)}d; Legacy ready ${legacyD.toFixed(2)}d; Fields=${s.field.index}; FE=${s.feThisLegacy.format(0)}`);
}

console.log('Phase 4 Mission Field tests: PASS');
