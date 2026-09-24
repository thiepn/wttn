(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./game-core.js'));
  else root.WTTNSave = factory(root.WTTNCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';

  const SAVE_KIND = 'word-to-the-nations-save';
  const SAVE_SCHEMA = 1;
  const MAX_SAVE_TEXT_CHARS = 2 * 1024 * 1024;

  function hashString(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  function makeEnvelope(currentState, savedAt = Date.now()) {
    if (!G) throw new Error('WTTN core is unavailable.');
    const timestamp = Number.isFinite(Number(savedAt)) ? Number(savedAt) : Date.now();
    const snapshot = JSON.parse(G.serializeState(currentState));
    snapshot.lastSavedAt = timestamp;
    const body = JSON.stringify(snapshot);
    return JSON.stringify({
      kind: SAVE_KIND,
      schema: SAVE_SCHEMA,
      gameVersion: G.VERSION,
      savedAt: timestamp,
      checksum: hashString(body),
      state: snapshot
    });
  }

  function parseSaveText(text) {
    if (!G) throw new Error('WTTN core is unavailable.');
    if (typeof text !== 'string') throw new Error('Save payload must be text.');
    if (text.length > MAX_SAVE_TEXT_CHARS) throw new Error('Save payload exceeds the 2 MB safety limit.');
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { throw new Error('Save is not valid JSON.'); }

    if (parsed?.kind === SAVE_KIND) {
      if (parsed.schema !== SAVE_SCHEMA || !parsed.state || typeof parsed.state !== 'object' || Array.isArray(parsed.state)) {
        throw new Error('Unsupported save envelope.');
      }
      if (typeof parsed.checksum !== 'string' || !/^[0-9a-f]{8}$/i.test(parsed.checksum)) throw new Error('Save checksum is malformed.');
      if (parsed.savedAt !== undefined && !Number.isFinite(Number(parsed.savedAt))) throw new Error('Save timestamp is invalid.');
      const body = JSON.stringify(parsed.state);
      if (hashString(body) !== parsed.checksum) throw new Error('Save checksum mismatch.');
      const validation = G.validateStatePayload(parsed.state);
      if (!validation.ok) throw new Error(validation.errors.join(' '));
      return {
        state: G.reviveState(parsed.state),
        savedAt: Number(parsed.savedAt || parsed.state.lastSavedAt || Date.now()),
        envelope: true
      };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Save root must be an object.');
    const validation = G.validateStatePayload(parsed);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    return {
      state: G.reviveState(parsed),
      savedAt: Number(parsed.lastSavedAt || Date.now()),
      envelope: false
    };
  }

  return { SAVE_KIND, SAVE_SCHEMA, MAX_SAVE_TEXT_CHARS, hashString, makeEnvelope, parseSaveText };
});
