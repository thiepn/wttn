/* Local-first synchronization. The economic envelope remains opaque and unchanged. */
(function (root, factory) {
  const api = factory(); if (typeof module === 'object') module.exports = api; root.WTTNCloudSync = api;
})(globalThis, function () {
  'use strict';
  const PREFIX = 'wttn.cloud.v1.', OWNER = PREFIX + 'owner', ORIGINAL = PREFIX + 'original', SWITCH = PREFIX + 'switch';
  const key = owner => PREFIX + 'slot.' + (owner || 'guest');
  function put(storage, name, value) {
    storage.setItem(name, value);
    if (storage.getItem(name) !== value) throw new Error('Local recovery storage is unavailable. Export your progress before continuing.');
  }
  function vault(storage, initial) {
    if (storage.getItem(SWITCH)) throw new Error('Finish interrupted account-switch recovery before linking an account.');
    const owner = storage.getItem(OWNER) || null;
    if (!storage.getItem(ORIGINAL)) put(storage, ORIGINAL, initial);
    function read(id) {
      const raw = storage.getItem(key(id));
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!value || value.version !== 1 || typeof value.snapshot !== 'string') throw new Error('Local account save needs recovery.');
      return value;
    }
    function write(id, data) { put(storage, key(id), JSON.stringify({ ...data, version: 1 })); }
    if (!read(owner)) write(owner, { snapshot: initial, revision: 0, enabled: false });
    return { read, write, owner: () => storage.getItem(OWNER) || null,
      select(id) { put(storage, OWNER, id || ''); }, original: () => storage.getItem(ORIGINAL) };
  }
  function create({ storage, initial, capture, apply, validate, meaningful, fresh, notify = () => {}, now = Date.now, uuid = () => crypto.randomUUID() }) {
    const local = vault(storage, initial);
    let owner = local.owner(), record = local.read(owner), user = null, repo = null;
    validate(record.snapshot);
    let generation = 0, busy = false, state = 'checking', remote = null, error = '', nextAttempt = 0, failures = 0, lastSync = record.lastSync || 0;
    let checkpoint = false, active = true, connected = false;
    const model = () => ({ state, owner, user, busy, error, lastSync, enabled: !!record.enabled, remote, local: capture(), nextAttempt });
    const emit = () => notify(model());
    function persist() { local.write(owner, record); }
    function assertOwner() { if (!active || owner !== local.owner()) throw new Error('Another tab changed the active account. Reopen this tab to continue safely.'); }
    function remember() {
      assertOwner(); record.snapshot = capture(); validate(record.snapshot); persist();
    }
    function cancel() { generation++; busy = false; remote = null; connected = false; }
    function fail(e) {
      failures++; nextAttempt = now() + Math.min(300000, 5000 * 2 ** Math.min(failures - 1, 6));
      state = 'unavailable'; error = 'Cloud saves are temporarily unavailable. Your local progress is retained.';
      if (e?.status === 401 || e?.code === '28000') { state = 'expired'; error = 'Session expired. Sign in again to resume synchronization.'; }
      if (e?.status === 429) error = 'Too many requests. Cloud saving will retry shortly.';
      emit();
    }
    function adopt(snapshot, revision, enabled = true) {
      validate(snapshot);
      // Preserve the losing branch before changing the live game or slot.
      put(storage, PREFIX + 'recovery.' + (owner || 'guest'), capture());
      apply(snapshot);
      record = { version: 1, snapshot: capture(), revision, enabled, synced: snapshot };
      persist();
    }
    async function attach(nextUser, nextRepo) {
      if (nextUser?.id === user?.id && connected) return;
      cancel(); const ticket = generation; user = nextUser; repo = nextRepo;
      try {
        assertOwner(); remember();
        const nextOwner = user?.id || null;
        if (nextOwner !== owner) {
          let next = local.read(nextOwner);
          // Only guest progress may be offered to a new account. Never copy account A into B.
          if (!next) next = { version: 1, snapshot: owner === null ? capture() : fresh(), revision: 0, enabled: false };
          validate(next.snapshot);
          const previous = capture();
          put(storage, SWITCH, JSON.stringify({version:1,owner,snapshot:previous}));
          try {
            local.write(nextOwner, next);
            apply(next.snapshot);
            local.select(nextOwner); owner = nextOwner; record = next;
            lastSync = record.lastSync || 0;
            record.snapshot = capture(); persist();
            storage.removeItem(SWITCH);
            if (storage.getItem(SWITCH)) throw new Error('Account-switch journal could not be cleared.');
          } catch (e) {
            // Fail closed; startup restores the journal before reading the active save.
            active = false; throw e;
          }
        }
        connected = true; error = ''; failures = 0;
        if (!user) { state = 'guest'; emit(); return; }
        state = 'checking'; emit();
        const result = await repo.read(); if (ticket !== generation) return;
        acceptRemote(result);
      } catch (e) { if (ticket === generation) fail(e); }
    }
    function acceptRemote(result) {
      if (!result || !Number.isSafeInteger(result.revision) || result.revision < 0) throw new Error('Invalid server revision');
      if (result.snapshot) validate(result.snapshot);
      remote = result;
      if (result.deleted) {
        record.enabled = false; record.pending = null; record.revision = result.revision; persist(); state = 'deleted';
      } else if (record.pending && result.requestId === record.pending.requestId) {
        record.revision = result.revision; record.synced = record.pending.snapshot; record.pending = null; lastSync = now(); record.lastSync=lastSync; persist(); state = 'ready';
      } else if (!result.snapshot) {
        record.revision = result.revision; persist(); state = 'offer';
      } else if (!record.enabled) {
        if (!meaningful(capture())) { adopt(result.snapshot, result.revision); state = 'ready'; lastSync = now(); }
        else state = 'conflict';
      } else if (result.revision !== record.revision) {
        // A save loaded and played locally is a real branch, even if the cloud is newer.
        state = 'conflict';
      } else state = 'ready';
      error = ''; emit();
    }
    async function sync({ force = false, significant = false } = {}) {
      checkpoint ||= significant;
      if (!user || !repo || busy || !active || !['ready', 'unavailable'].includes(state) || !record.enabled) return false;
      if (!force && now() < Math.max(nextAttempt, lastSync + 60000)) return false;
      const ticket = generation; busy = true; emit();
      try {
        assertOwner(); remember();
        if (!record.pending) {
          record.pending = { snapshot: record.snapshot, revision: record.revision, requestId: uuid(), checkpoint };
          checkpoint = false; persist();
        }
        const sent = record.pending, result = await repo.write(sent);
        if (ticket !== generation) return false;
        if (result.status === 'conflict' || result.status === 'deleted') { record.pending = null; persist(); acceptRemote(result); return false; }
        if (result.status !== 'saved') throw new Error('Unrecognized save response');
        record.revision = result.revision; record.synced = sent.snapshot; record.pending = null;
        state = 'ready'; remote = result; failures = 0; nextAttempt = 0; lastSync = now(); record.lastSync=lastSync; persist(); error = ''; return true;
      } catch (e) { if (ticket === generation) fail(e); return false; }
      finally { if (ticket === generation) { busy = false; emit(); } }
    }
    async function choose(choice) {
      if (!user || busy || !['offer','conflict','deleted'].includes(state)) return;
      const ticket = generation; busy = true; emit();
      try {
        assertOwner(); remember();
        const latest = await repo.read(); if (ticket !== generation) return;
        if (latest.revision !== remote?.revision) { acceptRemote(latest); return; }
        if (choice === 'cloud') {
          if (!latest.snapshot) throw new Error('Cloud snapshot no longer exists');
          adopt(latest.snapshot, latest.revision); state = 'ready'; lastSync = now();
        } else {
          if (latest.snapshot) { validate(latest.snapshot); put(storage, PREFIX + 'cloud-recovery.' + owner, latest.snapshot); }
          record.enabled = true; record.revision = latest.revision;
          record.pending = { snapshot: capture(), revision: latest.revision, requestId: uuid(), checkpoint: true, restore: !!latest.deleted }; persist();
          state = 'ready';
        }
      } catch (e) { if (ticket === generation) fail(e); }
      finally { if (ticket === generation) { busy = false; emit(); } }
      if (ticket === generation && choice === 'local' && state === 'ready') await sync({ force: true });
    }
    async function remove() {
      if (!user || busy) return false;
      cancel(); const ticket = generation; busy = true; record.enabled = false; record.pending = null; persist(); emit();
      try {
        assertOwner(); const latest = await repo.read(); if (ticket !== generation) return false;
        const result = await repo.remove({ revision: latest.revision, requestId: uuid() }); if (ticket !== generation) return false;
        acceptRemote(result); return result.deleted;
      } catch (e) { if (ticket === generation) fail(e); return false; }
      finally { if (ticket === generation) { busy = false; emit(); } }
    }
    return {
      attach, sync, choose, remove, model, remember,
      localChanged(significant = false) { try { remember(); checkpoint ||= significant; if (significant) void sync({ force: true, significant: true }); return true; } catch(e) { state = 'local-error'; error = e.message; emit(); return false; } },
      canSave: () => active && owner === local.owner() && !storage.getItem(SWITCH),
      unavailable(category) { state = category === 'authentication' ? 'expired' : 'unavailable'; error = 'Account temporarily unavailable. Local play remains available.'; emit(); },
      async retry() { connected = false; return attach(user, repo); },
      suspend() { cancel(); active = false; },
      resume() { active = true; },
      invalidate() { cancel(); state = 'checking'; emit(); },
      recovery: () => storage.getItem(PREFIX + 'recovery.' + (owner || 'guest')),
      cloudRecovery: () => storage.getItem(PREFIX + 'cloud-recovery.' + owner),
      ownerKey: OWNER
    };
  }
  function recoverSwitch(storage, restore) {
    const raw=storage.getItem(SWITCH); if (!raw) return false;
    const prior=JSON.parse(raw);
    if (prior.version!==1 || (prior.owner!==null && !/^[a-zA-Z0-9-]+$/.test(prior.owner)) || typeof prior.snapshot!=='string') throw new Error('Account-switch journal invalid');
    restore(prior.snapshot);
    put(storage,OWNER,prior.owner||'');
    storage.removeItem(SWITCH);
    if(storage.getItem(SWITCH))throw new Error('Account-switch recovery remains pending');
    return true;
  }
  function ownedSnapshot(storage) {
    const owner=storage.getItem(OWNER);
    if (!owner) return null;
    const raw=storage.getItem(key(owner));
    if (!raw) throw new Error('Owned local save is missing; recovery required.');
    const record=JSON.parse(raw);
    if(record.version!==1 || typeof record.snapshot!=='string')throw new Error('Owned local save is invalid.');
    return record.snapshot;
  }
  return { create, vault, recoverSwitch, ownedSnapshot, PREFIX, OWNER, SWITCH };
});
