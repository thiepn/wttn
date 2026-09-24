const assert = require('assert');
const G = require('../game-core.js');

function approx(actual, expected, eps = 1e-8) {
  assert(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`);
}

// Phase 2 saves migrate without inventing Network progress.
{
  const old = G.createState();
  const raw = JSON.parse(G.serializeState(old));
  raw.version = 2;
  delete raw.nc; delete raw.lifetimeNc; delete raw.tiThisNetwork; delete raw.networks;
  const s = G.reviveState(raw);
  assert.strictEqual(s.version, 8);
  assert(s.nc.eq(0) && s.lifetimeNc.eq(0) && s.tiThisNetwork.eq(0));
  assert.strictEqual(s.networks, 0);
}

// Network threshold is locally recalibrated for the playable Phase 2 economy.
{
  const s = G.createState();
  s.tiThisNetwork = G.NETWORK_BASE_THRESHOLD.sub(1);
  assert(G.networkGain(s).eq(0));
  s.tiThisNetwork = G.NETWORK_BASE_THRESHOLD;
  assert(G.networkGain(s).eq(1));
}

// Distribution remains inert before Network 1, then becomes a real four-channel economy.
{
  const s = G.createState();
  G.setAllocation(s, { local: .5, regional: .3, international: .1, digital: .1 });
  let e = G.allocationEffects(s);
  approx(e.local, 1); approx(e.regional, 1); approx(e.international, 1);
  s.networks = 1; s.lifetimeNc = G.bn(1); s.networkRunTime = 0;
  e = G.allocationEffects(s);
  assert(e.local > 2 && e.regional > 1 && e.international > 1);
  assert(e.digitalProjectDivisor < 1);
  assert(G.isAllocationValid(s, s.allocation));
  assert(!G.setAllocation(s, { local: .8, regional: .1, international: .05, digital: .05 }));
}

// Digital distribution lowers Project thresholds only after the Network layer exists.
{
  const s = G.createState();
  const base = G.projectThreshold(s, 'manuscript').toNumber();
  s.networks = 1; s.lifetimeNc = G.bn(1);
  G.setAllocation(s, { local: .1, regional: .2, international: .1, digital: .6 });
  const digital = G.projectThreshold(s, 'manuscript').toNumber();
  assert(digital < base * .6);
}

// Infrastructure is finite, immediate, and does not modify structural producer cost scaling.
{
  const s = G.createState();
  s.producers.scribe = 100;
  const p0 = G.pageProduction(s).toNumber();
  s.nc = G.bn(100);
  assert(G.buyNetworkUpgrade(s, 'infrastructure'));
  const p1 = G.pageProduction(s).toNumber();
  assert(p1 > p0 * 1.34 && p1 < p0 * 1.36);
  assert.strictEqual(s.netUpgrades.infrastructure, 1);
}

// Network reset clears the Translation economy but permanently solves base producer automation.
{
  const s = G.createState();
  s.tiThisNetwork = G.NETWORK_BASE_THRESHOLD; s.ti = G.bn(900); s.lifetimeTi = G.bn(3000);
  s.tiUpgrades = { workflow: 4, training: 3, preparation: 4 };
  for (const d of G.TI_ONE_TIMES) s.tiOneTime[d.id] = true;
  s.automation = { ...s.automation, basic: true, full: true, projects: true, translation: true };
  s.runTime = 1000; s.networkRunTime = 10000;
  const r = G.completeNetwork(s);
  assert(r.ok && r.gain.eq(1));
  assert.strictEqual(s.networks, 1);
  assert(s.ti.eq(0));
  assert.deepStrictEqual(s.tiUpgrades, { workflow: 0, training: 0, preparation: 0 });
  assert(s.automation.basic && s.automation.full);
  assert(!s.automation.projects && !s.automation.translation);
  assert(s.tiOneTime.basicAutomation && s.tiOneTime.fullAutomation);
  assert.strictEqual(s.networkRunTime, 0);
}

// Retention upgrades affect the next Network reset without granting runaway power.
{
  const s = G.createState();
  s.nc = G.bn(2000);
  for (const id of ['persistentWorkflow','trainingContinuity','persistentAutomation','translationContinuity']) assert(G.buyNetworkUpgrade(s, id));
  s.tiThisNetwork = G.NETWORK_BASE_THRESHOLD; s.networkRunTime = 7200;
  assert(G.completeNetwork(s).ok);
  assert(s.tiOneTime.buyMax);
  assert.strictEqual(s.tiUpgrades.preparation, 2);
  assert(s.automation.projects);
  assert(s.automation.translation);
}

function simulateReference() {
  const s = G.createState();
  let nextDecision = 0;

  function chooseAllocation() {
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

  const max = 42 * 3600;
  while (s.timePlayed < max && !G.fieldUnlocked(s)) {
    if (s.timePlayed + 1e-9 >= nextDecision) {
      let loops = 0;
      while (loops++ < 300 && act()) {}
      if (shouldNetwork()) G.completeNetwork(s);
      else if (!s.automation.translation && shouldTranslate()) G.completeTranslation(s, false);
      nextDecision = s.timePlayed + (s.timePlayed < 2 * 3600 ? 15 : 5 * 60);
    }
    G.tick(s, 1);
  }
  return s;
}

// Full Phase 3 timing regression.
{
  const s = simulateReference();
  const firstNetworkH = s.records.firstNetworkAt / 3600;
  const fieldH = s.records.fieldUnlockedAt / 3600;
  assert(firstNetworkH >= 7 && firstNetworkH <= 12, `first Network ${firstNetworkH.toFixed(2)}h outside 7–12h`);
  assert(G.fieldUnlocked(s), 'Mission Fields did not unlock by 42h');
  assert(fieldH >= 18 && fieldH <= 30, `Field unlock ${fieldH.toFixed(2)}h outside 18–30h`);
  assert(s.networks >= 4);
  assert(s.records.fastestNetwork >= 300, `Network reset collapsed to ${s.records.fastestNetwork}s`);
  assert(s.lifetimeNc.gte(G.FIELD_UNLOCK_LIFETIME_NC));
  console.log(`Phase 3 reference: first Network ${firstNetworkH.toFixed(2)}h; Field unlock ${fieldH.toFixed(2)}h; Networks=${s.networks}; lifetime NC=${s.lifetimeNc.format(0)}; fastest Network=${(s.records.fastestNetwork/3600).toFixed(2)}h`);
}

console.log('Phase 3 Network tests: PASS');
