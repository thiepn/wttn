const assert = require('assert');
const G = require('../game-core.js');

function simulate(spec) {
  const s = G.createState();
  let nextDecision = 0;

  function act() {
    if (G.specializationUnlocked(s) && !s.specialization) G.setSpecialization(s, spec);
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
    if (s.runTime < 4 * 60) return false;
    const last = s.records.lastTranslationGain;
    return last.isZero || gain.gte(last.mul(1.5)) || s.runTime >= 35 * 60;
  }

  while (s.timePlayed < 9 * 3600 && !s.tiOneTime.translationAutomation) {
    if (s.timePlayed + 1e-9 >= nextDecision) {
      let loops = 0;
      while (loops++ < 160 && act()) {}
      if (!s.automation.translation && shouldTranslate()) G.completeTranslation(s, false);
      nextDecision = s.timePlayed + (s.timePlayed < 2 * 3600 ? 15 : 5 * 60);
    }
    G.tick(s, 1);
  }
  return {
    id: spec,
    hours: s.records.translationAutomationAt == null ? Infinity : s.records.translationAutomationAt / 3600,
    translations: s.translations,
    lifetimeTi: s.lifetimeTi.toNumber()
  };
}

const results = G.SPECIALIZATIONS.map(x => simulate(x.id));
for (const r of results) assert(Number.isFinite(r.hours) && r.hours <= 9, `${r.id} failed to automate within 9h`);
console.log(results);
const hours = results.map(x => x.hours);
const spread = Math.max(...hours) / Math.min(...hours);
assert(spread <= 1.35, `specialization spread ${spread} > 1.35`);
console.log('Phase 2 specialization benchmark:', results.map(r => `${r.id} ${r.hours.toFixed(2)}h`).join(' | '), `| spread ${spread.toFixed(3)}x`);
console.log('Phase 2 specialization tests: PASS');
