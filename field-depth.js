(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WTTNFieldDepth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '2.1.0';

  const STRATEGIES = {
    urban: { pressure:'Allocation discipline', approach:'Keep all four channels at or below 40%; balanced configurations are safest.', emphasis:'Balanced distribution' },
    remote: { pressure:'Slow recovery', approach:'Lean on Regional and International while respecting the 20% Local cap.', emphasis:'Recovery without Local dependence' },
    oral: { pressure:'Producer inversion', approach:'Teachers and Projects carry unusual weight here; finish Projects instead of brute-forcing direct output.', emphasis:'Teachers + Projects' },
    restricted: { pressure:'Automation delay', approach:'Plan a manual Translation window until the 1,000-TI automation gate is cleared.', emphasis:'Manual reset timing' },
    multilingual: { pressure:'Long Translation cycles', approach:'International allocation and longer runs matter more because the Translation threshold is 10×.', emphasis:'Translation efficiency' },
    'urban-ii': { pressure:'Balanced digital network', approach:'Keep every channel ≤40% and Digital ≥20%; avoid over-specializing one route.', emphasis:'Four-way balance' },
    'remote-ii': { pressure:'Low production + low Preparation', approach:'Use Regional/International continuity and expect slower rebuilding with Local ≤10%.', emphasis:'Recovery planning' },
    'multilingual-ii': { pressure:'Extended Translation program', approach:'Build several deliberate Translation cycles while International remains capped at 40%.', emphasis:'Multi-cycle Translation' },
    'frontier-iii': { pressure:'Whole-system mastery', approach:'Complete all Projects, keep allocation balanced, and plan around the 2,500-TI automation gate.', emphasis:'Full-system execution' },
    'mature-field': { pressure:'Mature recovery', approach:'The Mature loop now rotates. Read the current pattern rather than repeating the previous allocation automatically.', emphasis:'Adaptive mastery' },
    'mature-stewardship': { pressure:'Recovery discipline', approach:'Rebuild efficiently and establish one sound Network; Local + Regional continuity is useful early.', emphasis:'Recovery discipline' },
    'mature-translation': { pressure:'Translation relay', approach:'Plan three deliberate Translations and lean on International capacity instead of short reset spam.', emphasis:'Translation cadence' },
    'mature-distribution': { pressure:'Route weave', approach:'Two valid Networks are required under tighter allocation constraints; use pair synergies deliberately.', emphasis:'Distribution planning' },
    'mature-integration': { pressure:'Whole-system integration', approach:'Complete all Projects while coordinating repeated Translations and two valid Networks.', emphasis:'Integrated execution' }
  };

  function fieldById(G, id) {
    return G.FIELDS.find(f => f.id === id) || (id === G.MATURE_FIELD.id ? G.MATURE_FIELD : null);
  }

  function routeState(state, G) {
    const counts = G.fieldClearCounts(state);
    const mastery = G.fieldMasteryStatus(state);
    const available = G.availableFields(state);
    return {
      counts,
      mastery,
      available,
      tier2Unlocked: counts.tier1 >= 3,
      tier3Unlocked: counts.tier2 >= 2,
      canonicalMastered: counts.total >= G.FIELDS.length,
      nextUnlock: counts.tier1 < 3
        ? `Clear ${3-counts.tier1} more Tier I Field${3-counts.tier1===2?'s':''} to open Tier II.`
        : counts.tier2 < 2
          ? `Clear ${2-counts.tier2} more Tier II Field${2-counts.tier2===2?'s':''} to open Frontier III.`
          : counts.total < G.FIELDS.length
            ? `${G.FIELDS.length-counts.total} canonical Field${G.FIELDS.length-counts.total===1?'':'s'} remain for full mastery.`
            : 'All canonical Fields are mastered; Mature Fields are available.'
    };
  }

  function fieldStatus(state, G, field) {
    if (!field) return 'locked';
    if (G.currentField(state)?.id === field.id) return 'active';
    if (!field.repeatable && (state.field?.cleared || []).includes(field.id)) return 'complete';
    if (field.repeatable && G.fieldClearCounts(state).total >= G.FIELDS.length) return 'available';
    return G.fieldEligibility(state, field) ? 'available' : 'locked';
  }

  function strategyFor(field) {
    if (field?.id === 'mature-field' && field?.patternId) return STRATEGIES[`mature-${field.patternId}`] || STRATEGIES['mature-field'];
    return STRATEGIES[field?.id] || { pressure:'Field adaptation', approach:'Read the active constraints and adapt the lower layers deliberately.', emphasis:'Adaptation' };
  }

  function bottleneck(state, G, field = G.currentField(state)) {
    if (!field) return { id:'entry', label:'Choose an available Field route.', detail:'Field objectives begin after entry.' };
    const status = G.fieldObjectiveStatus(state, field);
    const missing = status.items.filter(x => !x.met);
    if (!missing.length) return { id:'ready', label:'All clear conditions are satisfied.', detail:`Complete ${field.name} when you are ready to bank the FE reward.` };
    const first = missing[0];
    const strategy = strategyFor(field);
    return { id:first.id, label:first.label, detail:`Current bottleneck · ${strategy.emphasis}. ${strategy.approach}` };
  }

  function allocationSummary(a) {
    if (!a) return 'No allocation record';
    const pairs = [
      ['Local', a.local], ['Regional', a.regional], ['International', a.international], ['Digital', a.digital]
    ].sort((x,y) => (y[1]||0)-(x[1]||0));
    return `${pairs[0][0]}-led · ${Math.round((pairs[0][1]||0)*100)}%`;
  }

  function debrief(run, G) {
    if (!run) return null;
    const field = fieldById(G, run.id);
    let strategyField = field;
    if (run.id === 'mature-field') {
      const name = String(run.name || '').toLowerCase();
      const patternId = name.includes('translation') ? 'translation' : name.includes('distribution') ? 'distribution' : name.includes('integrated') ? 'integration' : 'stewardship';
      strategyField = { ...field, patternId };
    }
    const strategy = strategyFor(strategyField);
    const lastAllocation = Array.isArray(run.allocations) && run.allocations.length ? run.allocations[run.allocations.length-1] : null;
    return {
      id:run.id,
      name:run.name || field?.name || run.id,
      tier:run.tier || field?.tier || 0,
      duration:Number(run.duration)||0,
      gain:run.gain,
      validNetworks:Number(run.validNetworks)||0,
      translations:Number(run.translations)||0,
      projects:Array.isArray(run.projects) ? run.projects.length : 0,
      allocation:allocationSummary(lastAllocation),
      learned:field?.rewardText || 'Field Experience retained.',
      pressure:strategy.pressure,
      emphasis:strategy.emphasis
    };
  }

  function bestHistoryFor(state, fieldId) {
    const runs = (state.records?.recentFields || []).filter(r => r.id === fieldId && Number(r.duration) > 0);
    if (!runs.length) return null;
    return runs.reduce((best, run) => Number(run.duration) < Number(best.duration) ? run : best, runs[0]);
  }

  return { VERSION, STRATEGIES, routeState, fieldStatus, strategyFor, bottleneck, debrief, bestHistoryFor };
});
