(function (root, factory) {
  const core = typeof require === 'function' && typeof module === 'object' && module.exports
    ? require('./game-core.js')
    : root.WTTNCore;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WTTNDepth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';

  const version = '1.9.0';
  const ALLOCATION_TEMPLATES = {
    recovery: { label:'Recovery', allocation:{ local:.50, regional:.30, international:.10, digital:.10 }, intent:'Fast rebuilding after a Network reset.' },
    balanced: { label:'Balanced', allocation:{ local:.25, regional:.25, international:.25, digital:.25 }, intent:'Keep all four channels useful and preserve pair synergies.' },
    projects: { label:'Projects', allocation:{ local:.20, regional:.30, international:.20, digital:.30 }, intent:'Reduce Project friction while retaining steady production.' },
    translation: { label:'Translation', allocation:{ local:.10, regional:.40, international:.40, digital:.10 }, intent:'Favor sustained Pages and Translation Insight.' }
  };

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function specializationModel(state, id = state.specialization) {
    if (!id) {
      return {
        id:null, name:'Unspecialized', role:'General Translation practice',
        bestFor:'Build lifetime Translation Insight until a specialization unlocks, then choose the run shape that matches how you want to play.',
        tradeoff:'No specialization-specific recovery, long-run, or Project bonus is active yet.',
        runWindow:'Use readiness guidance',
        live:[['Page bonus','×1.00'],['TI bonus','×1.00'],['Readiness','Standard']]
      };
    }
    const target = id;
    if (target === 'scholar') {
      return {
        id:'scholar', name:'Scholar', role:'Long-cycle study',
        bestFor:'Longer runs, deliberate Project play, and strong late-run output.',
        tradeoff:'Slower immediate recovery than Publisher.',
        runWindow:'20–40 min',
        live:[
          ['Page ramp', `×${G.scholarMultiplier(state).toFixed(2)}`],
          ['TI dividend', `×${G.specializationTiMultiplier({ ...state, specialization:'scholar' }).toFixed(2)}`],
          ['Project strength', `×${(state.tradition === 'translation' ? 1.22 : 1.20).toFixed(2)}`]
        ]
      };
    }
    if (target === 'teacher') {
      const modelState = { ...state, specialization:'teacher' };
      const projects = ['manuscript','reference','teaching'].filter(x => !!state.projects?.[x]).length;
      return {
        id:'teacher', name:'Teacher', role:'Milestone & Project structure',
        bestFor:'Runs that complete Projects early and lean on producer milestones.',
        tradeoff:'Less raw recovery speed than Publisher and less late-run scaling than Scholar.',
        runWindow:'10–25 min',
        live:[
          ['Milestone bonus', state.tradition === 'translation' ? '×1.165' : '×1.15'],
          ['Project thresholds', '80%'],
          ['TI curriculum', `×${G.specializationTiMultiplier(modelState).toFixed(2)} · ${projects}/3 Projects`]
        ]
      };
    }
    const pre = state.lifetimeNc?.gt?.(0) ? 20*60 : 10*60;
    const publisherTarget = G.translationReadinessTarget({ ...state, specialization:'publisher' });
    return {
      id:'publisher', name:'Publisher', role:'Fast-cycle recovery',
      bestFor:'Shorter repeat cycles, rebuilding producers, and active play.',
      tradeoff:'No direct late-run production or Project multiplier.',
      runWindow:`${Math.round(publisherTarget/60)}–${Math.round(pre/60 + 8)} min`,
      live:[
        ['Base costs', state.tradition === 'translation' ? '×0.73' : '×0.75'],
        ['First 100', state.tradition === 'translation' ? '×0.89' : '×0.90'],
        ['Full readiness', `${(publisherTarget/60).toFixed(publisherTarget%60 ? 1 : 0)} min`]
      ]
    };
  }

  function nextOneTime(state) {
    for (const def of G.TI_ONE_TIMES) {
      if (state.tiOneTime?.[def.id]) continue;
      if (def.requires && !state.tiOneTime?.[def.requires]) continue;
      return def;
    }
    return null;
  }

  function repeatableOption(state, id) {
    const def = G.TI_REPEATABLES.find(x => x.id === id);
    const cost = G.repeatableCost(state, id);
    if (!def || !cost) return null;
    const level = state.tiUpgrades?.[id] || 0;
    if (id === 'workflow') return { id, name:def.name, level, cost, affordable:state.ti.gte(cost), impact:'×1.45 all Page production', score:Math.log(1.45)/Math.max(1,cost.toNumber()) };
    if (id === 'training') {
      const now = 1 + .08*level, next = 1 + .08*(level+1);
      return { id, name:def.name, level, cost, affordable:state.ti.gte(cost), impact:`Synergy factor ${now.toFixed(2)} → ${next.toFixed(2)}`, score:(Math.log(next/now)*2.2)/Math.max(1,cost.toNumber()) };
    }
    const nextLevel = Math.min(6, level+1);
    const effects = ['setup','10 Scribes','10 Copyists','first Methods','Projects visible','25 early producers','first four Methods'];
    return { id, name:def.name, level, cost, affordable:state.ti.gte(cost), impact:`Preparation Lv${nextLevel}: ${effects[nextLevel] || 'compressed setup'}`, score:(.22/(1+level*.35))/Math.max(1,cost.toNumber()) };
  }

  function translationInvestmentModel(state) {
    const permanent = nextOneTime(state);
    const repeatables = ['workflow','training','preparation'].map(id => repeatableOption(state,id)).filter(Boolean);
    let recommendation = null;
    if (permanent && state.ti.gte(permanent.cost)) {
      recommendation = { type:'permanent', id:permanent.id, title:`Unlock ${permanent.name}`, reason:'A permanent capability is affordable now; it generally outranks another temporary efficiency level.' };
    } else if (permanent && state.ti.toNumber() > 0 && permanent.cost <= state.ti.toNumber()*1.45) {
      recommendation = { type:'save', id:permanent.id, title:`Save for ${permanent.name}`, reason:`The next permanent unlock costs ${permanent.cost} TI and is close enough that spending now may delay it.` };
    } else if (repeatables.length) {
      const affordable = repeatables.filter(x => x.affordable);
      const pool = affordable.length ? affordable : repeatables;
      const best = [...pool].sort((a,b)=>b.score-a.score)[0];
      recommendation = { type:'repeatable', id:best.id, title:`Invest in ${best.name}`, reason:affordable.length ? `${best.impact}. It has the strongest current marginal efficiency among available repeatables.` : `Next repeatable target: ${best.cost.format(0)} TI.` };
    }
    return { permanent, repeatables, recommendation };
  }

  function recentEfficiency(records, type) {
    const runs = type === 'network' ? records?.recentNetworks : records?.recentTranslations;
    if (!Array.isArray(runs) || !runs.length) return 0;
    return Math.max(...runs.map(r => {
      const gain = r?.gain?.toNumber?.() ?? safeNumber(r?.gain);
      const duration = Math.max(1, safeNumber(r?.duration, 1));
      return gain / duration;
    }));
  }

  function translationResetModel(state) {
    const readiness = G.translationReadiness(state);
    const gain = G.translationGain(state).toNumber();
    const currentPerSec = gain / Math.max(1, state.runTime || 1);
    const recentBest = recentEfficiency(state.records, 'translation');
    const spec = specializationModel(state);
    let action = 'wait';
    let reason = readiness.recommendation;
    if (gain >= 1 && readiness.score >= .95 && (!recentBest || currentPerSec >= recentBest*.72)) {
      action = 'reset'; reason = 'Readiness is effectively full and current TI/time is competitive with your recent runs.';
    } else if (gain >= 1 && readiness.score >= .70 && recentBest && currentPerSec < recentBest*.45) {
      action = 'consider'; reason = 'This run is mature enough to reset, but its TI/time is well below your recent best. Resetting may still be useful for a specific unlock.';
    }
    return { gain, readiness, currentPerSec, recentBest, action, reason, specialization:spec };
  }

  function autoProfileSettings(state, id) {
    const post = state.lifetimeNc?.gt?.(0);
    if (id === 'active') return { enabled:true, minRun:post?12*60:7*60, resetMultiple:1.18, maxRun:post?28*60:18*60 };
    if (id === 'idle') return { enabled:true, minRun:post?30*60:20*60, resetMultiple:1.80, maxRun:post?3*3600:2*3600 };
    return { enabled:true, minRun:post?20*60:10*60, resetMultiple:1.35, maxRun:post?45*60:30*60 };
  }

  function autoProfiles(state) {
    return ['active','balanced','idle'].map(id => {
      const labels = { active:['Active','Frequent check-ins; favor faster cycles.'], balanced:['Balanced','Default compromise between reset speed and maturity.'], idle:['Idle','Longer cycles with fewer intervention points.'] };
      return { id, label:labels[id][0], description:labels[id][1], settings:autoProfileSettings(state,id) };
    });
  }

  function allocationPosture(state, allocation = state.allocation) {
    const a = allocation;
    const values = Object.entries(a).sort((x,y)=>y[1]-x[1]);
    const max = values[0]?.[1] || 0, min = values[values.length-1]?.[1] || 0;
    if (max-min <= .08) return { id:'balanced', label:'Balanced network', description:'No channel dominates. Pair synergies stay broadly available.' };
    if (a.local >= .40) return { id:'recovery', label:'Recovery network', description:'Local capacity dominates early-cycle rebuilding; its advantage decays with time.' };
    if (a.digital >= .30) return { id:'projects', label:'Project network', description:'Digital capacity lowers Project friction and pairs with Regional support.' };
    if (a.international >= .35) return { id:'translation', label:'Translation network', description:'International capacity prioritizes TI gain, especially when paired with Digital.' };
    if (a.regional >= .40) return { id:'steady', label:'Steady network', description:'Regional capacity favors stable Page throughput across the whole cycle.' };
    return { id:'mixed', label:'Mixed network', description:'A hybrid allocation without one dominant strategic posture.' };
  }

  function allocationMetrics(state, allocation) {
    const shadow = { ...state, allocation:{ ...allocation } };
    const e = G.allocationEffects(shadow);
    const s = e.synergies || G.allocationSynergies(shadow, allocation);
    return {
      pageMultiplier:e.local*e.regional,
      local:e.local,
      regional:e.regional,
      international:e.international,
      projectPercent:e.digitalProjectDivisor*100,
      recoveryBridge:s.recoveryBridge,
      insightBridge:s.insightBridge,
      projectBridge:s.projectBridge,
      valid:G.isAllocationValid(state, allocation),
      posture:allocationPosture(state, allocation)
    };
  }

  function allocationTemplateModels(state) {
    return Object.entries(ALLOCATION_TEMPLATES).map(([id,t]) => ({ id, ...t, metrics:allocationMetrics(state,t.allocation) }));
  }

  function networkResetModel(state) {
    const readiness=G.networkReadiness(state);
    const gain=G.networkGain(state).toNumber();
    const currentPerSec=gain/Math.max(1,state.networkRunTime||1);
    const recentBest=recentEfficiency(state.records,'network');
    let action='wait', reason=readiness.recommendation;
    if (gain>=1 && readiness.score>=.95 && (!recentBest || currentPerSec>=recentBest*.65)) { action='reset'; reason='Network readiness is full and NC/time is competitive with recent cycles.'; }
    else if (gain>=1 && readiness.score>=.70 && recentBest && currentPerSec<recentBest*.40) { action='consider'; reason='The cycle can reset, but NC/time is below your recent pace. Reset only if the next Network upgrade or Field objective makes it worthwhile.'; }
    return { gain, readiness, currentPerSec, recentBest, action, reason, posture:allocationPosture(state), metrics:allocationMetrics(state,state.allocation) };
  }

  return {
    version,
    ALLOCATION_TEMPLATES,
    specializationModel,
    translationInvestmentModel,
    translationResetModel,
    autoProfileSettings,
    autoProfiles,
    allocationPosture,
    allocationMetrics,
    allocationTemplateModels,
    networkResetModel
  };
});
