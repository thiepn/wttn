(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WTTNAtlas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FIELD_POINTS = [
    { id:'urban', label:'Urban I', x:760, y:92, tier:1 },
    { id:'remote', label:'Remote I', x:900, y:76, tier:1 },
    { id:'oral', label:'Oral I', x:1044, y:112, tier:1 },
    { id:'restricted', label:'Restricted I', x:784, y:204, tier:1 },
    { id:'multilingual', label:'Multi I', x:934, y:194, tier:1 },
    { id:'urban-ii', label:'Urban II', x:1080, y:210, tier:2 },
    { id:'remote-ii', label:'Remote II', x:790, y:322, tier:2 },
    { id:'multilingual-ii', label:'Multi II', x:934, y:330, tier:2 },
    { id:'frontier-iii', label:'Frontier III', x:1072, y:308, tier:3 }
  ];

  const STAGE_RANK = { work:0, translation:1, network:2, field:3, legacy:4, complete:5 };

  function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function positive(value) {
    if (value == null) return false;
    if (typeof value.gt === 'function') return value.gt(0);
    if (typeof value.gte === 'function') return value.gte(1);
    return number(value) > 0;
  }

  function safeBool(fn) {
    try { return !!fn(); } catch { return false; }
  }

  function deriveStage(state, G) {
    if (state?.campaign?.complete) return 'complete';
    const insight = number(state?.translations) > 0 || positive(state?.lifetimeTi) || positive(state?.ti);
    const network = insight && (
      !!state?.tiOneTime?.translationAutomation || !!state?.phase2Complete || number(state?.networks) > 0 ||
      positive(state?.lifetimeNc) || safeBool(() => G?.networkGain?.(state)?.gte?.(1))
    );
    const field = network && (
      !!state?.phase3Complete || !!state?.field?.active || number(state?.field?.index) > 0 || safeBool(() => G?.fieldUnlocked?.(state))
    );
    const legacy = field && (
      !!state?.phase4Complete || number(state?.legacies) > 0 || positive(state?.lifetimeLegacy) || safeBool(() => G?.legacyReady?.(state))
    );
    if (legacy) return 'legacy';
    if (field) return 'field';
    if (network) return 'network';
    if (insight) return 'translation';
    return 'work';
  }

  function allocation(state) {
    const raw = state?.allocation || {};
    const values = {
      local: Math.max(0, number(raw.local, .4)),
      regional: Math.max(0, number(raw.regional, .3)),
      international: Math.max(0, number(raw.international, .2)),
      digital: Math.max(0, number(raw.digital, .1))
    };
    const total = Object.values(values).reduce((a,b) => a+b, 0) || 1;
    for (const k of Object.keys(values)) values[k] /= total;
    return values;
  }

  function fieldStates(state, G) {
    const migrated = Array.isArray(state?.field?.cleared) && state.field.cleared.length
      ? state.field.cleared
      : FIELD_POINTS.slice(0, Math.max(0, Math.min(FIELD_POINTS.length, Math.floor(number(state?.field?.index))))).map(f => f.id);
    const cleared = new Set(migrated);
    const activeId = state?.field?.active ? (state.field.activeId || FIELD_POINTS[Math.floor(number(state.field.index))]?.id) : null;
    const available = new Set(safeBool(() => G?.availableFields?.(state)) ? G.availableFields(state).map(f => f.id) : []);
    const recommendedId = safeBool(() => G?.nextField?.(state)) ? G.nextField(state)?.id : null;
    return FIELD_POINTS.map(point => ({
      ...point,
      status: cleared.has(point.id) ? 'complete' : point.id === activeId ? 'active' : available.has(point.id) ? (point.id === recommendedId ? 'next' : 'available') : 'locked'
    }));
  }

  function stageCopy(stage, state) {
    const translations = Math.floor(number(state?.translations));
    const networks = Math.floor(number(state?.networks));
    const fields = Math.min(FIELD_POINTS.length, Math.floor(number(state?.field?.index)));
    const legacies = Math.floor(number(state?.legacies));
    const mature = Math.floor(number(state?.field?.matureClears));
    switch (stage) {
      case 'translation':
        return {
          eyebrow:'TRANSLATION BRANCHES',
          title:'Learning begins to branch.',
          narrative:`${translations} Translation${translations === 1 ? '' : 's'} completed. Each branch represents accumulated language-work practice, not a language or people group.`
        };
      case 'network':
        return {
          eyebrow:'DISTRIBUTION ROUTES',
          title:'The work begins to travel through a network.',
          narrative:`${networks} Network${networks === 1 ? '' : 's'} established. Route weight mirrors your current Local, Regional, International, and Digital allocation.`
        };
      case 'field':
        return {
          eyebrow:'MISSION FIELD ATLAS',
          title:'Different contexts now change the rules.',
          narrative:`${fields} of ${FIELD_POINTS.length} canonical Fields completed. Nodes are fictional campaign contexts, not real places or rankings of peoples.`
        };
      case 'legacy':
        return {
          eyebrow:'LEGACY TRACES',
          title:'Completed work leaves durable paths behind.',
          narrative:`${legacies} Legac${legacies === 1 ? 'y' : 'ies'} established · ${fields}/${FIELD_POINTS.length} canonical Fields sealed${mature ? ` · ${mature} Mature Field${mature === 1 ? '' : 's'}` : ''}.`
        };
      case 'complete':
        return {
          eyebrow:'CAMPAIGN ATLAS',
          title:'The designed campaign map is complete.',
          narrative:`All ${FIELD_POINTS.length} canonical Fields are sealed. The atlas records game progression only; it does not claim that real mission work or real peoples can be completed as a map.`
        };
      default:
        return {
          eyebrow:'FIRST PAGE',
          title:'Every route begins with careful work.',
          narrative:'The atlas begins with one prepared page. Complete the first Translation and the visual record will begin to grow.'
        };
    }
  }

  function actionFor(stage, state) {
    if (stage === 'complete') return { label:'Review Scripture Library', tab:'scripture' };
    if (stage === 'legacy') return { label:'Open Legacy', tab:'legacy' };
    if (stage === 'field') return { label: state?.field?.active ? 'Review active Field' : 'Open Mission Fields', tab:'fields' };
    if (stage === 'network') return { label:'Open Network', tab:'network' };
    if (stage === 'translation') return { label:'Open Translation Insight', tab:'insight' };
    return { label:'Prepare the first Translation', tab:'translation' };
  }

  function getAtlasModel(state, G) {
    const stage = deriveStage(state, G);
    const copy = stageCopy(stage, state);
    const alloc = allocation(state);
    const fields = fieldStates(state, G);
    const translations = Math.max(0, Math.floor(number(state?.translations)));
    const networks = Math.max(0, Math.floor(number(state?.networks)));
    const legacies = Math.max(0, Math.floor(number(state?.legacies)));
    const matureClears = Math.max(0, Math.floor(number(state?.field?.matureClears)));
    const canonicalCleared = Math.max(0, Math.min(FIELD_POINTS.length, Math.floor(number(state?.field?.index))));
    return {
      stage,
      rank: STAGE_RANK[stage],
      ...copy,
      action: actionFor(stage, state),
      translations,
      networks,
      legacies,
      matureClears,
      canonicalCleared,
      allocation: alloc,
      fields,
      activeField: fields.find(f => f.status === 'active') || null,
      nextField: fields.find(f => f.status === 'next') || null,
      showTranslation: STAGE_RANK[stage] >= STAGE_RANK.translation,
      showNetwork: STAGE_RANK[stage] >= STAGE_RANK.network,
      showFields: STAGE_RANK[stage] >= STAGE_RANK.field,
      showLegacy: STAGE_RANK[stage] >= STAGE_RANK.legacy,
      complete: stage === 'complete'
    };
  }

  function signature(model) {
    const a = model.allocation;
    return [
      model.stage, model.translations, model.networks, model.canonicalCleared,
      model.fields.findIndex(f => f.status === 'active'), model.legacies, model.matureClears,
      Math.round(a.local*20), Math.round(a.regional*20), Math.round(a.international*20), Math.round(a.digital*20)
    ].join('|');
  }

  return { FIELD_POINTS, STAGE_RANK, deriveStage, getAtlasModel, signature };
});
