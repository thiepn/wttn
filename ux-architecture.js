(function (root, factory) {
  const depth = typeof require === 'function' && typeof module === 'object' && module.exports ? require('./midgame-depth.js') : null;
  const api = factory(root, depth);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WTTNUX = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, depthModule) {
  'use strict';

  const pct = n => `${Math.round(Math.max(0, Math.min(1, Number(n) || 0)) * 100)}%`;
  const fmtCount = value => {
    if (value == null) return '—';
    if (typeof value.format === 'function') return value.format(0);
    return String(value);
  };

  function affordablePageUpgrade(state, G) {
    return G.PAGE_UPGRADES.find(def => !def.utility && !state.pageUpgrades[def.id] && state.pages.gte(G.bn(def.cost))) || null;
  }

  function recommendedProducer(state, G) {
    const affordable = G.PRODUCERS.filter(def => state.pages.gte(G.producerCost(def, state.producers[def.id], state)));
    if (!affordable.length) return null;
    return affordable[affordable.length - 1];
  }

  function nextProducerMilestone(state, G) {
    const thresholds = [10, 25, 50, 100, 250, 500];
    let best = null;
    for (const def of G.PRODUCERS) {
      const owned = state.producers[def.id] || 0;
      const target = thresholds.find(x => x > owned);
      if (!target) continue;
      const distance = target - owned;
      if (!best || distance < best.distance) best = { def, target, distance };
    }
    return best;
  }

  function nextProject(state, G) {
    const available = G.PROJECTS.find(def => !state.projects[def.id] && G.projectStatus(state, def.id).available);
    if (available) return { def: available, available: true };
    const locked = G.PROJECTS.find(def => !state.projects[def.id]);
    return locked ? { def: locked, available: false } : null;
  }

  function nextTiOneTime(state, G) {
    for (const def of G.TI_ONE_TIMES) {
      if (state.tiOneTime[def.id]) continue;
      if (def.requires && !state.tiOneTime[def.requires]) continue;
      return { def, affordable: state.ti.gte(def.cost) };
    }
    return null;
  }

  function cheapestRepeatable(state, G) {
    let best = null;
    for (const def of G.TI_REPEATABLES) {
      const cost = G.repeatableCost(state, def.id);
      if (!cost) continue;
      if (!best || cost.lt(best.cost)) best = { def, cost, affordable: state.ti.gte(cost) };
    }
    return best;
  }

  function nextNetworkUpgrade(state, G) {
    const options = G.NETWORK_UPGRADES.map(def => ({ def, cost: G.networkUpgradeCost(state, def.id) })).filter(x => x.cost);
    if (!options.length) return null;
    const affordable = options.filter(x => state.nc.gte(x.cost));
    if (affordable.length) {
      const oneTime = affordable.filter(x => !x.def.repeatable).sort((a,b) => a.cost.toNumber() - b.cost.toNumber());
      const best = oneTime[0] || affordable.sort((a,b) => a.cost.toNumber() - b.cost.toNumber())[0];
      return { ...best, affordable: true };
    }
    const next = options.sort((a,b) => a.cost.toNumber() - b.cost.toNumber())[0];
    return { ...next, affordable: false };
  }

  function work(state, G) {
    const gain = G.translationGain(state);
    const project = nextProject(state, G);
    const upgrade = affordablePageUpgrade(state, G);
    const producer = recommendedProducer(state, G);
    const milestone = nextProducerMilestone(state, G);

    if (gain.gte(1)) {
      return {
        eyebrow: 'PRIMARY DECISION',
        question: 'The Translation boundary is open. Reset now or keep building?',
        summary: `You can convert this run into ${gain.format(0)} Translation Insight. Continue buying only if the extra run time is worth the larger reset.`,
        metrics: [
          ['Production', `${G.pageProduction(state).format(2)} P/s`],
          ['Reset gain', `${gain.format(0)} TI`],
          ['Run', null, 'runTime']
        ],
        action: { label: 'Review Translation', tab: 'translation', target: 'translateBtn' },
        recommended: { type: 'translation' }
      };
    }
    if (project?.available) {
      return {
        eyebrow: 'PRIMARY DECISION',
        question: `Complete ${project.def.name} before pushing production further.`,
        summary: 'A Project is ready now. Completing it is the clearest immediate improvement before the next large purchase.',
        metrics: [
          ['Production', `${G.pageProduction(state).format(2)} P/s`],
          ['Project', 'Ready'],
          ['Peak Pages', state.peakPages.format(2)]
        ],
        action: { label: 'Open Projects', tab: 'projects', target: `project-${project.def.id}` },
        recommended: { type: 'project', id: project.def.id }
      };
    }
    if (upgrade) {
      return {
        eyebrow: 'PRIMARY DECISION',
        question: `Purchase ${upgrade.name}.`,
        summary: 'A one-run Method is already affordable and gives a clearer immediate return than waiting on a distant unlock.',
        metrics: [
          ['Cost', `${G.bn(upgrade.cost).format(2)} P`],
          ['Production', `${G.pageProduction(state).format(2)} P/s`],
          ['Peak Pages', state.peakPages.format(2)]
        ],
        action: { label: 'Focus Method', target: `upgrade-${upgrade.id}` },
        recommended: { type: 'upgrade', id: upgrade.id }
      };
    }
    if (producer) {
      const cost = G.producerCost(producer, state.producers[producer.id], state);
      return {
        eyebrow: 'PRIMARY DECISION',
        question: `Invest in ${producer.name}.`,
        summary: 'This is the highest production tier you can currently afford. Build the chain while watching the next producer milestone.',
        metrics: [
          ['Next cost', `${cost.format(2)} P`],
          ['Owned', String(state.producers[producer.id] || 0)],
          ['Production', `${G.pageProduction(state).format(2)} P/s`]
        ],
        action: { label: `Focus ${producer.name}`, target: `producer-${producer.id}` },
        recommended: { type: 'producer', id: producer.id }
      };
    }
    return {
      eyebrow: 'PRIMARY DECISION',
      question: 'Build production toward the next meaningful purchase.',
      summary: milestone ? `${milestone.def.name} reaches its next milestone at ${milestone.target} owned.` : 'Keep production growing toward the Translation threshold.',
      metrics: [
        ['Production', `${G.pageProduction(state).format(2)} P/s`],
        ['Pages', state.pages.format(2)],
        ['Next milestone', milestone ? `${milestone.def.name} ${milestone.target}` : 'Translation']
      ],
      action: { label: 'Review producers', target: 'producerGrid' },
      recommended: null
    };
  }

  function projects(state, G) {
    const next = nextProject(state, G);
    const completed = G.PROJECTS.filter(def => state.projects[def.id]).length;
    if (!next) return {
      eyebrow: 'PRIMARY DECISION', question: 'All Projects for this run are complete.',
      summary: 'Return to production or prepare the next Translation; Projects have no further manual work this run.',
      metrics: [['Completed', `${completed} / ${G.PROJECTS.length}`], ['Production', `${G.pageProduction(state).format(2)} P/s`], ['Peak Pages', state.peakPages.format(2)]],
      action: { label: 'Return to Work', tab: 'work', target: 'producerGrid' }
    };
    const status = G.projectStatus(state, next.def.id);
    return {
      eyebrow: 'PRIMARY DECISION',
      question: next.available ? `Complete ${next.def.name}.` : `Prepare ${next.def.name}.`,
      summary: next.available ? 'Its requirements are met. Complete it now before investing elsewhere.' : 'This is the next unfinished Project. Its requirement list below shows the exact bottleneck.',
      metrics: [['Completed', `${completed} / ${G.PROJECTS.length}`], ['Status', next.available ? 'Ready' : 'Building'], ['Peak Pages', state.peakPages.format(2)]],
      action: { label: next.available ? 'Focus ready Project' : 'Inspect requirements', target: `project-${next.def.id}` },
      recommended: { type: 'project', id: next.def.id }
    };
  }

  function translation(state, G) {
    const gain = G.translationGain(state);
    const ready = G.translationReadiness(state);
    const efficiency = G.translationEfficiency(state);
    let question = 'Reach the Translation threshold before resetting.';
    let summary = ready.recommendation;
    let label = 'Build Pages';
    let tab = 'work';
    let target = 'producerGrid';
    if (gain.gte(1)) {
      if (ready.score >= 0.8) { question = `Reset now for ${gain.format(0)} TI, or deliberately extend the run.`; label = 'Focus reset'; tab = null; target = 'translateBtn'; }
      else { question = `A reset is available, but readiness is only ${pct(ready.score)}.`; label = 'Keep building'; tab = 'work'; target = 'producerGrid'; }
      summary = ready.recommendation;
    }
    return {
      eyebrow: 'RESET DECISION', question, summary,
      metrics: [['Gain now', `${gain.format(0)} TI`], ['Readiness', pct(ready.score)], ['Efficiency', `${Number(efficiency || 0).toFixed(2)} TI/min`]],
      action: { label, tab, target },
      tone: gain.gte(1) && ready.score >= .8 ? 'ready' : ready.score < .55 && gain.gte(1) ? 'caution' : 'neutral'
    };
  }

  function insight(state, G) {
    const depth = depthModule || root?.WTTNDepth;
    const investment = depth?.translationInvestmentModel?.(state) || null;
    const nextOne = investment?.permanent ? { def: investment.permanent, affordable: state.ti.gte(investment.permanent.cost) } : nextTiOneTime(state, G);
    const rec = investment?.recommendation || null;
    const repeatable = rec?.type === 'repeatable' ? G.TI_REPEATABLES.find(x => x.id === rec.id) : null;

    if (G.specializationUnlocked(state) && !state.specialization) return {
      eyebrow: 'BUILD DECISION', question: 'Choose the specialization that defines your current Translation style.',
      summary: 'Scholar rewards longer runs, Publisher accelerates recovery, and Teacher strengthens milestones and Projects. The choice can change on later Translations.',
      metrics: [['Available', `${state.ti.format(0)} TI`], ['Lifetime', `${state.lifetimeTi.format(0)} TI`], ['Specialization', 'Choose now']],
      action: { label: 'Compare specializations', target: 'specializationGrid' }
    };
    if (rec?.type === 'permanent' && nextOne) return {
      eyebrow: 'BUILD DECISION', question: `${rec.title}.`, summary: rec.reason,
      metrics: [['Available', `${state.ti.format(0)} TI`], ['Cost', `${nextOne.def.cost} TI`], ['Current build', state.specialization || 'Unspecialized']],
      action: { label: 'Focus permanent unlock', target: `ti-onetime-${nextOne.def.id}` },
      recommended: { type: 'ti-onetime', id: nextOne.def.id }
    };
    if (rec?.type === 'save' && nextOne) return {
      eyebrow: 'BUILD DECISION', question: `${rec.title}.`, summary: rec.reason,
      metrics: [['Available', `${state.ti.format(0)} TI`], ['Next unlock', `${nextOne.def.cost} TI`], ['Specialization', state.specialization || 'Unspecialized']],
      action: { label: 'Keep saving', target: `ti-onetime-${nextOne.def.id}` }
    };
    if (rec?.type === 'repeatable' && repeatable) {
      const cost = G.repeatableCost(state, repeatable.id);
      return {
        eyebrow: 'BUILD DECISION', question: `${rec.title}.`, summary: rec.reason,
        metrics: [['Available', `${state.ti.format(0)} TI`], ['Repeatable cost', `${cost?.format(0) || '—'} TI`], ['Current build', state.specialization || 'Unspecialized']],
        action: { label: `Focus ${repeatable.name}`, target: `ti-repeatable-${repeatable.id}` },
        recommended: { type: 'ti-repeatable', id: repeatable.id }
      };
    }

    const fallbackOne = nextTiOneTime(state, G);
    const fallbackRepeatable = cheapestRepeatable(state, G);
    if (!investment && fallbackOne?.affordable) return {
      eyebrow: 'BUILD DECISION', question: `Unlock ${fallbackOne.def.name}.`,
      summary: 'The next permanent Translation-development unlock is affordable now.',
      metrics: [['Available', `${state.ti.format(0)} TI`], ['Cost', `${fallbackOne.def.cost} TI`], ['Current build', state.specialization || 'Unspecialized']],
      action: { label: 'Focus permanent unlock', target: `ti-onetime-${fallbackOne.def.id}` },
      recommended: { type: 'ti-onetime', id: fallbackOne.def.id }
    };
    if (!investment && fallbackRepeatable?.affordable) return {
      eyebrow: 'BUILD DECISION', question: `Improve ${fallbackRepeatable.def.name}.`,
      summary: 'This repeatable is affordable and no nearby permanent breakpoint is being reserved.',
      metrics: [['Available', `${state.ti.format(0)} TI`], ['Repeatable cost', `${fallbackRepeatable.cost.format(0)} TI`], ['Current build', state.specialization || 'Unspecialized']],
      action: { label: `Focus ${fallbackRepeatable.def.name}`, target: `ti-repeatable-${fallbackRepeatable.def.id}` },
      recommended: { type: 'ti-repeatable', id: fallbackRepeatable.def.id }
    };
    const shown = nextOne || fallbackOne;
    return {
      eyebrow: 'BUILD DECISION', question: shown ? `Save for ${shown.def.name}.` : 'Tune the Translation build around the next reset.',
      summary: shown ? `You need ${shown.def.cost} TI for the next permanent unlock.` : 'Use repeatables, specialization, presets, and automation to shape the run rather than chasing every purchase equally.',
      metrics: [['Available', `${state.ti.format(0)} TI`], ['Next unlock', shown ? `${shown.def.cost} TI` : 'Development complete'], ['Specialization', state.specialization || 'None']],
      action: { label: shown ? 'Review development' : 'Review automation', target: shown ? 'oneTimeGrid' : 'automationWorkspace' }
    };
  }

  function network(state, G) {
    const gain = G.networkGain(state);
    const ready = G.networkReadiness(state);
    const nextUpgrade = nextNetworkUpgrade(state, G);
    if (state.networks === 0) return {
      eyebrow: 'PRIMARY DECISION', question: gain.gte(1) ? `The first Network can be established for ${gain.format(0)} NC.` : 'Build Translation Insight toward the first Network.',
      summary: ready.recommendation,
      metrics: [['Gain now', `${gain.format(0)} NC`], ['TI this cycle', state.tiThisNetwork.format(0)], ['Readiness', pct(ready.score)]],
      action: { label: gain.gte(1) ? 'Review Network reset' : 'Return to Translation', tab: gain.gte(1) ? null : 'translation', target: gain.gte(1) ? 'networkResetBtn' : 'translateBtn' },
      tone: gain.gte(1) ? 'ready' : 'neutral'
    };
    const field = G.currentField(state);
    if (field) return {
      eyebrow: 'ALLOCATION DECISION', question: `Tune distribution for ${field.name}.`,
      summary: 'The active Field changes what counts as a legal/effective Network. Allocation is the current strategic lever; reset timing comes second.',
      metrics: [['Field NC', `${state.field.progressNc.format(0)} / ${G.fieldThreshold(state).format(0)}`], ['Gain now', `${gain.format(0)} NC`], ['Readiness', pct(ready.score)]],
      action: { label: 'Tune allocation', target: 'allocationGrid' }
    };
    if (nextUpgrade?.affordable) return {
      eyebrow: 'INVESTMENT DECISION', question: `Purchase ${nextUpgrade.def.name} before the next Network.`,
      summary: 'A Network-development upgrade is affordable now. Spend capacity deliberately before committing the next reset.',
      metrics: [['Available', `${state.nc.format(0)} NC`], ['Cost', `${nextUpgrade.cost.format(0)} NC`], ['Reset gain', `${gain.format(0)} NC`]],
      action: { label: 'Focus Network development', target: `network-upgrade-${nextUpgrade.def.id}` },
      recommended: { type: 'network-upgrade', id: nextUpgrade.def.id }
    };
    if (gain.gte(1) && ready.score >= .8) return {
      eyebrow: 'RESET DECISION', question: `Establish the next Network for ${gain.format(0)} NC.`,
      summary: ready.recommendation,
      metrics: [['Gain now', `${gain.format(0)} NC`], ['Readiness', pct(ready.score)], ['Allocation', 'Adjust before reset']],
      action: { label: 'Focus Network reset', target: 'networkResetBtn' }, tone: 'ready'
    };
    return {
      eyebrow: 'ALLOCATION DECISION', question: 'Tune distribution while this Network matures.',
      summary: ready.recommendation,
      metrics: [['Gain now', `${gain.format(0)} NC`], ['Readiness', pct(ready.score)], ['Available', `${state.nc.format(0)} NC`]],
      action: { label: 'Tune allocation', target: 'allocationGrid' }
    };
  }

  function fields(state, G) {
    const current = G.currentField(state);
    const next = G.nextField(state);
    const available = G.availableFields ? G.availableFields(state) : (next ? [next] : []);
    if (current) return {
      eyebrow: 'CHALLENGE DECISION', question: `Solve ${current.name}.`,
      summary: 'Meet the Field-specific Network, Translation, allocation, and Project conditions. Only actions satisfying the Field rules count toward completion.',
      metrics: [['Valid NC', `${state.field.progressNc.format(0)} / ${G.fieldThreshold(state).format(0)}`], ['Valid Networks', String(state.field.stats.validNetworks || 0)], ['Translations', String(state.field.stats.translations || 0)]],
      action: { label: G.fieldReward(state).gte(1) ? 'Review completion' : 'Inspect objectives', target: G.fieldReward(state).gte(1) ? 'completeFieldBtn' : 'fieldObjectiveList' },
      tone: G.fieldReward(state).gte(1) ? 'ready' : 'neutral'
    };
    if (G.canEnterField(state)) return {
      eyebrow: 'ROUTE DECISION', question: available.length > 1 ? `Choose among ${available.length} available Mission Fields.` : `Enter ${next?.name || 'the next Mission Field'}.`,
      summary: available.length > 1 ? 'The route has branched. Rewards arrive in different orders, so choose the constraint that best fits your current campaign plan.' : 'The entry requirement is satisfied. Starting the Field will reset the lower economy and make its constraints active.',
      metrics: [['Available routes', String(available.length || 1)], ['Recommended', next?.name || 'Mature Field'], ['Lifetime FE', state.lifetimeFe.format(0)]],
      action: { label: available.length > 1 ? 'Compare Field routes' : 'Focus Field entry', target: available.length > 1 ? 'fieldGrid' : 'enterFieldBtn' }, tone: 'ready'
    };
    return {
      eyebrow: 'CHALLENGE DECISION', question: next ? `Prepare to enter ${next.name}.` : 'The canonical Field campaign is complete.',
      summary: next ? 'Build fresh Network Capacity until the entry threshold is met.' : 'Repeat Mature Fields or move attention to Legacy/campaign completion.',
      metrics: [['Next Field', next?.name || 'Mature Field'], ['Fresh NC', state.ncThisField.format(0)], ['Lifetime FE', state.lifetimeFe.format(0)]],
      action: { label: 'Build Network Capacity', tab: 'network', target: 'networkResetBtn' }
    };
  }

  function legacy(state, G) {
    const gain = G.legacyGain(state);
    const ready = G.legacyReadiness(state);
    if (G.finalSequenceAvailable(state)) return {
      eyebrow: 'CAMPAIGN DECISION', question: 'The final campaign sequence is ready.',
      summary: 'All canonical Field and lifetime Legacy requirements are satisfied. Complete the designed campaign when you are ready.',
      metrics: [['Lifetime Legacy', state.lifetimeLegacy.format(0)], ['Canonical Fields', `${Math.min(state.field.index, G.FIELDS.length)} / ${G.FIELDS.length}`], ['Final sequence', 'Ready']],
      action: { label: 'Review campaign ending', target: 'campaignCompleteBtn' }, tone: 'ready'
    };
    if (gain.gte(1)) return {
      eyebrow: 'RESET DECISION', question: `Establish Legacy for ${gain.format(0)} L, or continue this era.`,
      summary: ready.recommendation,
      metrics: [['Gain now', `${gain.format(0)} L`], ['Readiness', pct(ready.score)], ['Lifetime', `${state.lifetimeLegacy.format(0)} L`]],
      action: { label: 'Focus Legacy reset', target: 'legacyResetBtn' }, tone: ready.score >= .8 ? 'ready' : 'caution'
    };
    return {
      eyebrow: 'ERA DECISION', question: 'Build Field Experience toward the next Legacy.',
      summary: 'Legacy is not another production multiplier. Complete Fields and carry solved methods forward once the era has enough experience.',
      metrics: [['This era', `${state.feThisLegacy.format(0)} / ${G.LEGACY_UNLOCK_FE.format(0)} FE`], ['Lifetime Legacy', state.lifetimeLegacy.format(0)], ['Tradition', state.tradition ? G.traditionDef(state.tradition)?.name || state.tradition : 'Not chosen']],
      action: { label: 'Open Mission Fields', tab: 'fields', target: 'fieldGrid' }
    };
  }

  function getAll(state, G) {
    return {
      work: work(state, G),
      projects: projects(state, G),
      translation: translation(state, G),
      insight: insight(state, G),
      network: network(state, G),
      fields: fields(state, G),
      legacy: legacy(state, G)
    };
  }

  return { getAll, work, projects, translation, insight, network, fields, legacy };
});
