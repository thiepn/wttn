(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WTTNDisclosure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAB_ORDER = ['work','projects','translation','insight','network','fields','legacy','scripture','stats','system'];
  const RESOURCE_ORDER = ['pages','ti','nc','fe','legacy'];

  function positive(value) {
    if (value == null) return false;
    if (typeof value.gt === 'function') return value.gt(0);
    if (typeof value.gte === 'function') return value.gte(1);
    const n = Number(value);
    return Number.isFinite(n) && n > 0;
  }

  function safeBool(fn, fallback = false) {
    try { return !!fn(); } catch { return fallback; }
  }

  function getDisclosure(state, G) {
    const insight = Number(state?.translations || 0) > 0 || positive(state?.lifetimeTi) || positive(state?.ti);
    const network = insight && (
      !!state?.tiOneTime?.translationAutomation ||
      !!state?.phase2Complete ||
      Number(state?.networks || 0) > 0 ||
      positive(state?.lifetimeNc) ||
      safeBool(() => G?.networkGain?.(state)?.gte?.(1))
    );
    const fields = network && (
      !!state?.phase3Complete ||
      !!state?.field?.active ||
      Number(state?.field?.index || 0) > 0 ||
      safeBool(() => G?.fieldUnlocked?.(state))
    );
    const legacy = fields && (
      !!state?.phase4Complete ||
      Number(state?.legacies || 0) > 0 ||
      positive(state?.lifetimeLegacy) ||
      safeBool(() => G?.legacyReady?.(state))
    );
    const scripture = true;

    const tabs = {
      work: true,
      projects: true,
      translation: true,
      insight,
      network,
      fields,
      legacy,
      scripture,
      stats: true,
      system: true
    };

    const resources = {
      pages: true,
      ti: insight,
      nc: Number(state?.networks || 0) > 0 || positive(state?.lifetimeNc) || positive(state?.nc),
      fe: Number(state?.field?.index || 0) > 0 || positive(state?.lifetimeFe) || positive(state?.fe),
      legacy: Number(state?.legacies || 0) > 0 || positive(state?.lifetimeLegacy) || positive(state?.legacy)
    };

    let stage = 'work';
    if (insight) stage = 'translation';
    if (network) stage = 'network';
    if (fields) stage = 'field';
    if (legacy) stage = 'legacy';
    if (state?.campaign?.complete) stage = 'complete';

    return {
      tabs,
      resources,
      stage,
      visibleTabs: TAB_ORDER.filter(id => tabs[id]),
      visibleResources: RESOURCE_ORDER.filter(id => resources[id])
    };
  }

  function isTabVisible(disclosure, id) {
    return !!disclosure?.tabs?.[id];
  }

  return { TAB_ORDER, RESOURCE_ORDER, getDisclosure, isTabVisible };
});
