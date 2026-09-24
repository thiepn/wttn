'use strict';

function makeRng(seed = 1) {
  let x = (seed >>> 0) || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

const BASE_STRATEGY = {
  name: 'normal',
  specialization: 'publisher',
  tradition: 'distribution',
  earlyDecisionSeconds: 15,
  decisionSeconds: 300,
  earlyDecisionUntil: 2 * 3600,
  firstTranslationSeconds: 35 * 60,
  translationMinPreNetwork: 4 * 60,
  translationMinPostNetwork: 10 * 60,
  translationMultiple: 1.5,
  translationMaxPreNetwork: 35 * 60,
  translationMaxPostNetwork: 45 * 60,
  networkMinSeconds: 60 * 60,
  networkMultiple: 1.5,
  networkMaxSeconds: 4 * 3600,
  legacyMinSeconds: 8 * 3600,
  legacyMultiple: 1.5,
  legacyMaxSeconds: 3 * 86400,
  tiOrder: 'one-time-first',
  networkOrder: 'infrastructure-first',
  producerOrder: 'high-tier-first',
  allocationMode: 'optimized',
  fieldRouteMode: 'canonical',
  maxDays: 26,
  configureAutoTranslation: false,
  seed: 1,
};

function fieldAllocationLegal(field, a, normalCap = 0.70) {
  const vals = [a.local, a.regional, a.international, a.digital];
  const sum = vals.reduce((x, y) => x + y, 0);
  if (Math.abs(sum - 1) > 1e-6 || vals.some(v => v < -1e-9)) return false;
  const cap = field?.allocationCap ?? normalCap;
  if (vals.some(v => v > cap + 1e-9)) return false;
  if (field?.localCap != null && a.local > field.localCap + 1e-9) return false;
  if (field?.internationalCap != null && a.international > field.internationalCap + 1e-9) return false;
  if (field?.digitalMin != null && a.digital < field.digitalMin - 1e-9) return false;
  return true;
}

function simulateCampaign(G, overrides = {}) {
  const cfg = { ...BASE_STRATEGY, ...overrides };
  const rng = makeRng(cfg.seed);
  const s = G.createState();
  const metrics = {
    name: cfg.name,
    majorEvents: [], fieldClears: [], checkpoints: {},
    invalidAllocationAttempts: 0, decisions: 0,
  };
  let nextDecision = 0;

  function remember(name) {
    if (!metrics.checkpoints[name]) metrics.checkpoints[name] = G.serializeState(s);
  }
  function event(type, detail = {}) { metrics.majorEvents.push({ at: s.timePlayed, type, ...detail }); }

  function candidateAllocations() {
    const field = G.currentField(s);
    const base = G.recommendedFieldAllocation(field);
    if (cfg.allocationMode === 'balanced') return [base, {local:.25,regional:.25,international:.25,digital:.25}];
    if (cfg.allocationMode === 'local-heavy') return [{local:.6,regional:.2,international:.1,digital:.1}, {local:.4,regional:.3,international:.15,digital:.15}, base];
    if (cfg.allocationMode === 'international-heavy') return [{local:.1,regional:.25,international:.55,digital:.1}, {local:.15,regional:.25,international:.45,digital:.15}, base];
    if (cfg.allocationMode === 'random') {
      const out = [];
      for (let i = 0; i < 10; i++) {
        const raw = [rng(), rng(), rng(), rng()]; const sum = raw.reduce((a,b)=>a+b,0);
        out.push({ local:raw[0]/sum, regional:raw[1]/sum, international:raw[2]/sum, digital:raw[3]/sum });
      }
      out.push(base); return out;
    }
    if (field) {
      if (s.networkRunTime < 20 * 60) return [
        {local:.4,regional:.25,international:.15,digital:.2},
        {local:.2,regional:.35,international:.25,digital:.2}, base
      ];
      if (Object.values(s.projects).some(v => !v)) return [
        {local:.1,regional:.3,international:.2,digital:.4},
        {local:.2,regional:.25,international:.2,digital:.35}, base
      ];
      return [
        {local:.1,regional:.35,international:.4,digital:.15},
        {local:.2,regional:.3,international:.35,digital:.15}, base
      ];
    }
    if (s.networks === 0) return [base];
    if (s.networkRunTime < 20 * 60 || s.peakPages.lt('1e9')) return [{local:.5,regional:.3,international:.1,digital:.1}, base];
    if (Object.values(s.projects).some(v => !v)) return [{local:.2,regional:.3,international:.2,digital:.3}, base];
    return [{local:.1,regional:.4,international:.4,digital:.1}, base];
  }

  function chooseAllocation() {
    for (const a of candidateAllocations()) {
      if (G.setAllocation(s, a)) return true;
      metrics.invalidAllocationAttempts++;
    }
    return false;
  }

  function buyNetworkDevelopment() {
    const oneTimes = G.NETWORK_UPGRADES.filter(x => !x.repeatable);
    const buyOneTime = () => {
      for (const def of oneTimes) {
        const cost = G.networkUpgradeCost(s, def.id);
        if (cost && s.nc.gte(cost)) return G.buyNetworkUpgrade(s, def.id);
      }
      return false;
    };
    const buyInfra = () => {
      const cost = G.networkUpgradeCost(s, 'infrastructure');
      return !!(cost && s.nc.gte(cost) && G.buyNetworkUpgrade(s, 'infrastructure'));
    };
    return cfg.networkOrder === 'one-time-first' ? (buyOneTime() || buyInfra()) : (buyInfra() || buyOneTime());
  }

  function buyTiDevelopment() {
    const buyOneTime = () => {
      for (const def of G.TI_ONE_TIMES) {
        if (!s.tiOneTime[def.id]) {
          if (G.oneTimeAvailable(s, def.id) && s.ti.gte(def.cost)) return G.buyTiOneTime(s, def.id);
          break;
        }
      }
      return false;
    };
    const ids = cfg.tiOrder === 'workflow-heavy'
      ? ['workflow','workflow','training','preparation']
      : ['workflow','training','preparation'];
    const buyRepeatable = () => {
      for (const id of ids) {
        const cost = G.repeatableCost(s, id);
        if (cost && s.ti.gte(cost)) return G.buyTiRepeatable(s, id);
      }
      return false;
    };
    return cfg.tiOrder === 'repeatables-first' || cfg.tiOrder === 'workflow-heavy'
      ? (buyRepeatable() || buyOneTime())
      : (buyOneTime() || buyRepeatable());
  }

  function configureMeta() {
    if (G.specializationUnlocked(s) && !s.specialization) G.setSpecialization(s, cfg.specialization);
    if (s.legacies > 0 && !s.tradition) G.setTradition(s, cfg.tradition);
    if (cfg.configureAutoTranslation && s.tiOneTime.translationAutomation) {
      const post = s.lifetimeNc.gt(0);
      G.setAutoSettings(s, {
        enabled: true,
        minRun: post ? cfg.translationMinPostNetwork : cfg.translationMinPreNetwork,
        resetMultiple: cfg.translationMultiple,
        maxRun: post ? cfg.translationMaxPostNetwork : cfg.translationMaxPreNetwork,
      });
    }
  }

  function actOne() {
    configureMeta();
    chooseAllocation();
    if (buyNetworkDevelopment()) return true;
    if (buyTiDevelopment()) return true;
    for (const p of G.PROJECTS) {
      if (G.projectStatus(s, p.id).available && !s.projects[p.id]) return !!G.completeProject(s, p.id);
    }
    for (const u of G.PAGE_UPGRADES) if (!s.pageUpgrades[u.id] && s.pages.gte(u.cost)) return G.buyPageUpgrade(s, u.id);
    const producers = cfg.producerOrder === 'cheap-first' ? G.PRODUCERS : [...G.PRODUCERS].reverse();
    for (const p of producers) {
      if (G.maxAffordableProducerCount(s, p.id, 10000) > 0) {
        G.buyProducer(s, p.id, 'max'); return true;
      }
    }
    return false;
  }

  function shouldTranslate() {
    const gain = G.translationGain(s); if (gain.lt(1)) return false;
    if (s.translations === 0) return s.runTime >= cfg.firstTranslationSeconds;
    const post = s.lifetimeNc.gt(0);
    const min = post ? cfg.translationMinPostNetwork : cfg.translationMinPreNetwork;
    const max = post ? cfg.translationMaxPostNetwork : cfg.translationMaxPreNetwork;
    if (s.runTime < min) return false;
    const last = s.records.lastTranslationGain;
    return last.isZero || gain.gte(last.mul(cfg.translationMultiple)) || s.runTime >= max;
  }

  function shouldNetwork() {
    const gain = G.networkGain(s); if (gain.lt(1)) return false;
    if (s.networks === 0) return true;
    if (s.networkRunTime < cfg.networkMinSeconds) return false;
    const last = s.records.recentNetworks[0]?.gain || G.bn(0);
    return last.isZero || gain.gte(last.mul(cfg.networkMultiple)) || s.networkRunTime >= cfg.networkMaxSeconds;
  }

  function shouldLegacy() {
    if(cfg.sessions && s.field.active) return false;
    const gain = G.legacyGain(s); if (gain.lt(1)) return false;
    if (s.legacies === 0) return true;
    if (s.legacyRunTime < cfg.legacyMinSeconds) return false;
    const last = s.records.recentLegacies[0]?.gain || G.bn(0);
    return last.isZero || gain.gte(last.mul(cfg.legacyMultiple)) || s.legacyRunTime >= cfg.legacyMaxSeconds;
  }

  function chooseFieldRoute() {
    const available = G.availableFields(s);
    if (!available.length) return null;
    if (cfg.fieldRouteMode === 'random') return available[Math.floor(rng() * available.length)];
    const priorities = {
      'frontier-fast': ['urban','remote','multilingual','urban-ii','remote-ii','frontier-iii','oral','restricted','multilingual-ii'],
      'retention-first': ['oral','restricted','remote','multilingual','urban','remote-ii','urban-ii','multilingual-ii','frontier-iii'],
      'distribution-first': ['multilingual','urban','remote','oral','restricted','urban-ii','multilingual-ii','remote-ii','frontier-iii'],
      'hard-first': ['multilingual','restricted','oral','remote','urban','multilingual-ii','remote-ii','urban-ii','frontier-iii']
    };
    const order = priorities[cfg.fieldRouteMode];
    if (order) {
      for (const id of order) {
        const field = available.find(f => f.id === id);
        if (field) return field;
      }
    }
    return available[0];
  }

  const maxSeconds = cfg.maxDays * 86400;
  while (s.timePlayed < maxSeconds && !s.campaign.complete) {
    if (s.timePlayed + 1e-9 >= nextDecision) {
      metrics.decisions++;
      let loops = 0;
      while (loops++ < 1200 && actOne()) {}
      if (loops >= 1200) throw new Error(`${cfg.name}: decision purchase loop runaway`);

      if (shouldLegacy()) {
        const r = G.completeLegacy(s); if (r.ok) { event('legacy', { gain:r.gain.toNumber() }); remember(`legacy-${s.legacies}`); }
      } else if (s.field.active && G.fieldReward(s).gte(1)) {
        const f = G.currentField(s); const objective = G.fieldObjectiveStatus(s, f);
        const fieldStats = { validNetworks:s.field.stats.validNetworks, networks:s.field.stats.networks, translations:s.field.stats.translations, progressNc:s.field.progressNc.toNumber() };
        const r = G.completeField(s);
        if (r.ok) {
          const canonicalTotal = G.fieldClearCounts(s).total;
          metrics.fieldClears.push({ id:f.id, tier:f.tier, at:s.timePlayed, duration:r.duration, gain:r.gain.toNumber(), objectiveMet:objective.met, canonicalTotal, ...fieldStats });
          event('field', { id:f.id, gain:r.gain.toNumber() });
          if (canonicalTotal >= G.FIELDS.length) remember('all-canonical-fields');
        }
      } else if (!s.field.active && G.canEnterField(s)) {
        const f = chooseFieldRoute(); if (f && G.enterField(s, f.id).ok) event('field-enter', { id:f.id });
      } else if (shouldNetwork()) {
        const r = G.completeNetwork(s); if (r.ok) { event('network', { gain:r.gain.toNumber() }); if (s.networks === 1) remember('first-network'); }
      } else if ((!s.automation.translation || !G.autoTranslationAllowed(s)) && shouldTranslate()) {
        const r = G.completeTranslation(s, false); if (r.ok) event('translation', { gain:r.gain.toNumber() });
      }
      if (G.finalSequenceAvailable(s) && !s.campaign.complete) {
        if (G.completeCampaign(s)) { event('campaign-complete'); remember('campaign-complete'); }
      }
      if (s.records.firstFieldAt != null) remember('first-field');
      if (s.records.firstLegacyAt != null) remember('first-legacy');
      nextDecision = s.timePlayed + (s.timePlayed < cfg.earlyDecisionUntil ? cfg.earlyDecisionSeconds : cfg.decisionSeconds);
      if (cfg.sessions) {
        const day=Math.floor(s.timePlayed/86400), tod=s.timePlayed-day*86400;
        const current=cfg.sessions.find(start=>tod>=start && tod<start+cfg.sessionSeconds);
        if(current!==undefined && tod+15<current+cfg.sessionSeconds) nextDecision=s.timePlayed+15;
        else {
          const later=cfg.sessions.find(start=>start>tod);
          nextDecision=later===undefined?(day+1)*86400+cfg.sessions[0]:day*86400+later;
          // These finite orders are explicitly chosen while the simulated player is present.
          if(G.queueUnlocked(s) && !s.automation.full) {
            s.purchaseQueue.orders=[];
            const highest=Math.max(0,G.PRODUCERS.findLastIndex(p=>s.producers[p.id]>0));
            for(const i of [highest,highest+1,highest+2,highest+1,highest+2,highest+3]) {
              const p=G.PRODUCERS[i];if(!p)continue;
              const prior=s.purchaseQueue.orders.findLast(o=>o.id===p.id)?.target || s.producers[p.id];
              const target=[1,10,25,50,100,250].find(n=>n>prior)||prior+25;
              G.enqueuePurchase(s,{type:'producer',id:p.id,target});
            }
          }
        }
      }
    }
    const untilDecision = Math.max(0.001, nextDecision - s.timePlayed);
    // tick() itself advances in the canonical 10-second economic cadence, so
    // jumping directly to the next player decision is exact but much faster.
    if(cfg.sessions && untilDecision>60) G.simulateOffline(s,Math.min(untilDecision,maxSeconds-s.timePlayed));
    else G.tick(s,untilDecision);
  }

  const completeAt = s.records.campaignCompleteAt;
  metrics.completeDays = completeAt == null ? Infinity : completeAt / 86400;
  metrics.firstNetworkHours = s.records.firstNetworkAt == null ? Infinity : s.records.firstNetworkAt / 3600;
  metrics.firstFieldHours = s.records.firstFieldAt == null ? Infinity : s.records.firstFieldAt / 3600;
  metrics.firstLegacyDays = s.records.firstLegacyAt == null ? Infinity : s.records.firstLegacyAt / 86400;
  metrics.allFieldsDays = metrics.fieldClears.find(x => x.canonicalTotal >= G.FIELDS.length)?.at / 86400 ?? Infinity;
  metrics.fastestTranslation = s.records.fastestTranslation;
  metrics.fastestNetwork = s.records.fastestNetwork;
  metrics.legacies = s.legacies;
  metrics.lifetimeLegacy = s.lifetimeLegacy.toNumber();
  metrics.matureFields = s.field.matureClears;
  return { state:s, metrics, strategy:cfg };
}

module.exports = { BASE_STRATEGY, simulateCampaign, makeRng, fieldAllocationLegal };
