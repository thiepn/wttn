const assert = require('assert');
const G = require('../game-core.js');

function approx(actual, expected, eps = 1e-8) {
  assert(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`);
}

// Phase 4 saves migrate without inventing Legacy progress.
{
  const raw = JSON.parse(G.serializeState(G.createState()));
  raw.version = 4;
  delete raw.legacy; delete raw.lifetimeLegacy; delete raw.legacies; delete raw.legacyRunTime;
  delete raw.tradition; delete raw.queuedTradition; delete raw.library; delete raw.phase5Complete;
  if (raw.field) delete raw.field.matureClears;
  const s = G.reviveState(raw);
  assert.strictEqual(s.version, 8);
  assert(s.legacy.eq(0) && s.lifetimeLegacy.eq(0));
  assert.strictEqual(s.legacies, 0);
  assert.strictEqual(s.field.matureClears, 0);
  assert.strictEqual(s.campaign.complete, false);
}

// Legacy formula keeps the certified 70 FE -> 15 Legacy denomination.
{
  const s = G.createState();
  s.feThisLegacy = G.bn(69);
  assert(G.legacyGain(s).eq(0));
  s.feThisLegacy = G.bn(70);
  assert(G.legacyReady(s));
  assert(G.legacyGain(s).eq(15), `70 FE should yield 15 Legacy, got ${G.legacyGain(s).format(4)}`);
  s.feThisLegacy = G.bn(280);
  const expected = Math.floor((280 / 70) ** G.LEGACY_EXPONENT * G.LEGACY_SCALE);
  assert.strictEqual(G.legacyGain(s).toNumber(), expected);
}

// Legacy reset preserves campaign progress while rebuilding currencies/development.
{
  const s = G.createState();
  s.fe = G.bn(70); s.feThisLegacy = G.bn(70); s.lifetimeFe = G.bn(70);
  s.field.index = 4; s.campaign.tier1 = 4;
  s.fieldRewards.allocationCap = .75; s.fieldRewards.persistentAutomation = true;
  s.ti = G.bn(500); s.nc = G.bn(20); s.pages = G.bn('1e30');
  s.specialization = 'publisher';
  const r = G.completeLegacy(s);
  assert(r.ok && r.gain.eq(15));
  assert(s.lifetimeLegacy.eq(15) && s.legacy.eq(15) && s.legacies === 1);
  assert.strictEqual(s.field.index, 4);
  assert.strictEqual(s.campaign.tier1, 4);
  approx(s.fieldRewards.allocationCap, .75);
  assert.strictEqual(s.fieldRewards.persistentAutomation, true);
  assert(s.fe.eq(0) && s.feThisLegacy.eq(0));
  assert(s.nc.eq(0));
  assert(s.pages.eq(0));
  assert.strictEqual(s.specialization, 'publisher', '15 lifetime Legacy should retain specialization');
  const milestones = G.legacyMilestones(s);
  assert(milestones.foundationalMethods && milestones.buyMax && milestones.automation && milestones.translationUnlocked);
  assert(!milestones.firstTranslationCompressed);
}

// Traditions are locked until first Legacy and affect only their intended systems.
{
  const s = G.createState();
  assert(!G.setTradition(s, 'distribution'));
  s.legacies = 1;
  assert(G.setTradition(s, 'distribution'));
  approx(G.allocationLimits(s).cap, .75);

  const pioneer = G.createState(); pioneer.legacies = 1; pioneer.tradition = 'pioneer'; pioneer.field.active = true; pioneer.field.index = 0;
  const normal = G.createState(); normal.field.active = true; normal.field.index = 0;
  approx(G.fieldThreshold(pioneer).toNumber() / G.fieldThreshold(normal).toNumber(), .88, 1e-6);

  const translation = G.createState(); translation.legacies = 1; translation.tradition = 'translation'; translation.tiUpgrades.preparation = 1;
  assert.strictEqual(G.effectivePreparationLevel(translation), 2);

  const teaching = G.createState(); teaching.legacies = 1; teaching.tradition = 'teaching'; teaching.producers.scribe = 100; teaching.projects.manuscript = true;
  const base = G.createState(); base.producers.scribe = 100; base.projects.manuscript = true;
  assert(G.pageProduction(teaching).gt(G.pageProduction(base)), 'Teaching Tradition should strengthen milestones/projects');
}

// Scripture Library unlocks are permanent signposts rather than spendable resources.
{
  const s = G.createState();
  assert(!G.scriptureCollectionUnlocked(s, 'torah'));
  s.translations = 1; assert(G.scriptureCollectionUnlocked(s, 'torah'));
  s.records.translationAutomationAt = 100; assert(G.scriptureCollectionUnlocked(s, 'history'));
  s.networks = 1; assert(G.scriptureCollectionUnlocked(s, 'wisdom'));
  s.field.index = 3; assert(G.scriptureCollectionUnlocked(s, 'prophets')); assert(G.scriptureCollectionUnlocked(s, 'gospels'));
  s.campaign.tier1 = 5; assert(G.scriptureCollectionUnlocked(s, 'acts'));
  s.legacies = 1; assert(G.scriptureCollectionUnlocked(s, 'epistles'));
  s.lifetimeLegacy = G.bn(100); s.campaign.tier2 = 3; s.campaign.tier3 = 1; s.field.matureClears = G.MATURE_FIELD_PATTERNS.length;
  assert(G.scriptureCollectionUnlocked(s, 'revelation'));
  G.updateLibraryUnlocks(s);
  assert(Object.values(s.library).filter(Boolean).length >= 8);
}

// After all canonical Fields, Mature Field becomes a renewable FE loop without changing canonical counts.
{
  const s = G.createState();
  s.field.index = G.FIELDS.length;
  s.lifetimeNc = G.bn(100); s.ncThisField = G.bn(1); s.campaign = { tier1: 5, tier2: 3, tier3: 1, complete: false };
  assert.strictEqual(G.nextField(s).id, 'mature-field');
  assert(G.enterField(s).ok);
  assert.strictEqual(G.currentField(s).id, 'mature-field');
  s.field.progressNc = G.fieldThreshold(s).max(20);
  s.field.stats.validNetworks = 1;
  const gain = G.fieldReward(s);
  assert(gain.gte(1));
  const before = { ...s.campaign };
  assert(G.completeField(s).ok);
  assert.strictEqual(s.field.index, G.FIELDS.length);
  assert.strictEqual(s.field.matureClears, 1);
  assert.deepStrictEqual(s.campaign, before);
}

// Final sequence needs both canonical Field mastery and 100 lifetime Legacy.
{
  const s = G.createState();
  s.lifetimeLegacy = G.bn(100);
  s.campaign.tier1 = 5; s.campaign.tier2 = 3; s.campaign.tier3 = 0;
  assert(!G.finalSequenceAvailable(s));
  s.campaign.tier3 = 1;
  assert(!G.finalSequenceAvailable(s), 'final sequence should also require one complete Mature cycle');
  s.field.matureClears = G.MATURE_FIELD_PATTERNS.length;
  assert(G.finalSequenceAvailable(s));
  assert(G.completeCampaign(s));
  assert(s.campaign.complete && s.phase5Complete);
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
    if (G.specializationUnlocked(s) && !s.specialization) G.setSpecialization(s, 'publisher');
    if (s.legacies > 0 && !s.tradition) G.setTradition(s, 'distribution');
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
    const gain = G.translationGain(s); if (gain.lt(1)) return false;
    if (s.translations === 0) return s.runTime >= 35 * 60;
    const min = s.lifetimeNc.gt(0) ? 10 * 60 : 4 * 60;
    if (s.runTime < min) return false;
    const last = s.records.lastTranslationGain;
    return last.isZero || gain.gte(last.mul(1.5)) || s.runTime >= (s.lifetimeNc.gt(0) ? 45 * 60 : 35 * 60);
  }

  function shouldNetwork() {
    const gain = G.networkGain(s); if (gain.lt(1)) return false;
    if (s.networks === 0) return true;
    if (s.networkRunTime < 60 * 60) return false;
    const last = s.records.recentNetworks[0]?.gain || G.bn(0);
    return last.isZero || gain.gte(last.mul(1.5)) || s.networkRunTime >= 4 * 3600;
  }

  function shouldLegacy() {
    const gain = G.legacyGain(s); if (gain.lt(1)) return false;
    if (s.legacies === 0) return true;
    if (s.legacyRunTime < 8 * 3600) return false;
    const last = s.records.recentLegacies[0]?.gain || G.bn(0);
    return last.isZero || gain.gte(last.mul(1.5)) || s.legacyRunTime >= 3 * 86400;
  }

  const max = 16 * 86400;
  while (s.timePlayed < max && !s.campaign.complete) {
    if (s.timePlayed + 1e-9 >= nextDecision) {
      let loops = 0; while (loops++ < 1000 && act()) {}
      if (shouldLegacy()) G.completeLegacy(s);
      else if (s.field.active && G.fieldReward(s).gte(1)) G.completeField(s);
      else if (!s.field.active && G.canEnterField(s)) G.enterField(s);
      else if (shouldNetwork()) G.completeNetwork(s);
      else if ((!s.automation.translation || !G.autoTranslationAllowed(s)) && shouldTranslate()) G.completeTranslation(s, false);
      if (G.finalSequenceAvailable(s) && !s.campaign.complete) G.completeCampaign(s);
      nextDecision = s.timePlayed + (s.timePlayed < 2 * 3600 ? 15 : 5 * 60);
    }
    G.tick(s, 1);
  }
  return s;
}

// Full 0h -> campaign completion regression.
{
  const s = simulateReference();
  const firstLegacyD = s.records.firstLegacyAt / 86400;
  const allFields = [...s.records.recentFields].filter(x => x.id === 'frontier-iii').sort((a,b) => a.at-b.at)[0];
  const allFieldsD = allFields?.at / 86400;
  const finalPhaseD = s.records.finalPhaseAt / 86400;
  const completeD = s.records.campaignCompleteAt / 86400;
  assert(firstLegacyD >= 2 && firstLegacyD <= 4, `first Legacy ${firstLegacyD.toFixed(2)}d outside 2–4d`);
  assert(allFieldsD >= 4 && allFieldsD <= 10, `all canonical Fields ${allFieldsD.toFixed(2)}d outside 4–10d`);
  assert(finalPhaseD >= 7 && finalPhaseD <= 14.5, `final phase ${finalPhaseD.toFixed(2)}d outside 7–14.5d`);
  assert(completeD >= 7 && completeD <= 14.5, `campaign complete ${completeD.toFixed(2)}d outside 7–14.5d`);
  assert(s.campaign.complete, 'campaign did not complete');
  assert(s.lifetimeLegacy.gte(100), `only ${s.lifetimeLegacy.format(0)} lifetime Legacy`);
  assert.strictEqual(s.campaign.tier1, 5); assert.strictEqual(s.campaign.tier2, 3); assert.strictEqual(s.campaign.tier3, 1);
  assert(s.field.matureClears >= 1, 'Mature Fields were never used');
  assert(s.records.fastestNetwork >= 300, `Network reset collapsed to ${s.records.fastestNetwork}s`);
  assert(s.records.fastestTranslation >= 90, `Translation reset collapsed to ${s.records.fastestTranslation}s`);
  console.log(`Phase 5 reference: first Legacy ${firstLegacyD.toFixed(2)}d; canonical Fields ${allFieldsD.toFixed(2)}d; final ${finalPhaseD.toFixed(2)}d; complete ${completeD.toFixed(2)}d; Legacies=${s.legacies}; lifetime L=${s.lifetimeLegacy.format(0)}; Mature=${s.field.matureClears}`);
}

console.log('Phase 5 Legacy + Campaign tests: PASS');
