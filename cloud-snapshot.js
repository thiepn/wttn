(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('./game-core') : root.WTTNCore,
    typeof module === 'object' ? require('./save-format') : root.WTTNSave,
    typeof module === 'object' ? require('./full-backup') : root.WTTNFullBackup);
  if (typeof module === 'object') module.exports = api; root.WTTNCloudSnapshot = api;
})(globalThis, function (G, S, F) {
  'use strict';
  function prepare(text, now = Date.now()) {
    const parsed = F.parse(text);
    if (!parsed.full) throw new Error('Cloud saves must include their arrangement.');
    const gap = Math.max(0, (now - parsed.savedAt) / 1000);
    const summary = parsed.state.system?.offlineEnabled && gap >= 5 ? G.simulateOffline(parsed.state, gap) : null;
    // Simulate before stamping the new envelope. Receiving a snapshot is not play time.
    const snapshot = F.make(S.makeEnvelope(parsed.state, now), parsed.placements);
    return { parsed: F.parse(snapshot), snapshot, summary };
  }
  function meaningful(text) {
    const s = F.parse(text).state;
    return s.translations > 0 || s.networks > 0 || s.legacies > 0 ||
      Object.values(s.producers).some(n => n > 0) || Object.values(s.pageUpgrades).some(Boolean) ||
      Object.values(s.projects).some(Boolean) || s.field.index > 0 || s.reading?.bookmarks?.length > 0;
  }
  return { prepare, meaningful };
});
