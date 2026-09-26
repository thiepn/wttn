(async function () {
  'use strict';
  const G = window.WTTNCore;
  const S = window.WTTNSave;
  const C = window.WTTNContent || {};
  const K = window.WTTNContentDepth || {};
  const D = window.WTTNDisclosure;
  const U = window.WTTNUX;
  const A = window.WTTNAtlas;
  const R = window.WTTNArt;
  const M = window.WTTNMotion;
  const Q = window.WTTNAudio;
  const E = window.WTTNEarlyGame;
  const X = window.WTTNDepth;
  const F = window.WTTNFieldDepth;
  const L = window.WTTNLegacyDepth;
  const W = window.WTTNWorkshopModel;
  const WS = window.WTTNWorkshopScreens;
  const SAVE_KEY = 'wttn.phase6.save.v6';
  const BACKUP_KEY = 'wttn.phase6.backup.v6';
  const LEGACY_SAVE_KEYS = ['wttn.phase5.save.v5','wttn.phase4.save.v4','wttn.phase3.save.v3','wttn.phase2.save.v2','wttn.phase1.save.v1'];
  const SMOKE_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('smoke');
  const APP_VERSION = '2.10.6';
  const UI_PREFS_KEY = 'wttn.ui.preferences.v1';
  const $ = id => document.getElementById(id);
  const paint = (element, markup) => window.WTTNView.patch(element, markup);
  let renderScheduled = false;
  let lastSection = 'work';
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  let deferredInstallPrompt = null;
  let swRegistration = null;
  let lastAtlasSignature = '';
  let reloadingForUpdate = false;
  let atlasScale = 1;
  let atlasPointerDrag = null;
  let rafId = null;
  let uiPrefs = loadUiPreferences();

  function readableAmount(value, digits = 2) {
    if (!value || value.isZero) return '0';
    const exponent = value.log10;
    if (!Number.isFinite(exponent)) return value.format(digits);
    const group = Math.min(6, Math.max(0, Math.floor(exponent / 3)));
    if (exponent >= 21) return value.format(digits);
    const labels = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
    return (10 ** (exponent - group * 3)).toLocaleString('en-US', { maximumFractionDigits: digits }) + labels[group];
  }
  const fmtTime = sec => {
    if (sec == null || !Number.isFinite(sec)) return '—';
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    return `${m}:${String(ss).padStart(2,'0')}`;
  };
  const fmtEta = sec => {
    if (sec === 0) return 'Ready';
    if (sec == null || !Number.isFinite(sec) || sec < 0) return 'Insufficient history';
    if (sec > 365 * 86400) return '>1 year';
    return `≈ ${fmtTime(sec)}`;
  };

  function storageGet(key) { try { return window.WTTNSaveStorage.decode(window.localStorage?.getItem(key) ?? null); } catch { return null; } }
  function storageSet(key, value) { return window.WTTNSaveStorage.write(() => window.localStorage, key, value).ok; }
  function storageRemove(key) { try { window.localStorage?.removeItem(key); return true; } catch { return false; } }


  function loadUiPreferences() {
    const defaults = { motion: 'system', textScale: '100', contrast: 'system' };
    try {
      const parsed = JSON.parse(storageGet(UI_PREFS_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return defaults;
      return {
        motion: ['system','reduce'].includes(parsed.motion) ? parsed.motion : defaults.motion,
        textScale: ['100','110','120'].includes(String(parsed.textScale)) ? String(parsed.textScale) : defaults.textScale,
        contrast: ['system','high'].includes(parsed.contrast) ? parsed.contrast : defaults.contrast
      };
    } catch { return defaults; }
  }

  function prefersReducedMotion() {
    return uiPrefs.motion === 'reduce' || (uiPrefs.motion === 'system' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  function applyUiPreferences({ persist = false, announce = false } = {}) {
    const root = document.documentElement;
    root.dataset.motion = uiPrefs.motion;
    root.dataset.textScale = uiPrefs.textScale;
    root.dataset.contrast = uiPrefs.contrast;
    if (persist) storageSet(UI_PREFS_KEY, JSON.stringify(uiPrefs));
    if (announce) toast('Accessibility preferences updated');
  }

  function isNarrowViewport() { return window.matchMedia?.('(max-width: 760px)').matches ?? window.innerWidth <= 760; }

  function safeScrollIntoView(el, options = {}) {
    if (!el?.scrollIntoView) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest', ...options });
  }

  const makeEnvelope = S.makeEnvelope;
  const parseSaveText = S.parseSaveText;
  const MIGRATION_KEY = 'wttn.pre-schema7.backup';
  function preserveMigration(text) {
    const raw=JSON.parse(text), version=(raw.state || raw).version || 0;
    if (version >= 8) return true;
    if (storageGet(MIGRATION_KEY)) return true;
    return storageSet(MIGRATION_KEY,text);
  }

  function readCandidate(raw, source, recovered = false) {
    if (!raw) return null;
    try {
      const parsed = parseSaveText(raw);
      return { ...parsed, raw, source, recovered };
    } catch (error) {
      console.warn(`Stored save failed validation (${source})`, error);
      return null;
    }
  }

  async function load() {
    const localPrimary = storageGet(SAVE_KEY);
    const localBackup = storageGet(BACKUP_KEY);
    let durablePrimary = null, durableBackup = null;
    try {
      [durablePrimary, durableBackup] = await Promise.all([
        window.WTTNSaveStorage.durableGet(SAVE_KEY),
        window.WTTNSaveStorage.durableGet(BACKUP_KEY)
      ]);
    } catch (error) { console.warn('IndexedDB save store is unavailable; using localStorage fallback.', error); }

    const primaries = [
      readCandidate(durablePrimary, 'indexeddb'),
      readCandidate(localPrimary, 'primary')
    ].filter(Boolean).sort((a,b)=>Number(b.savedAt||0)-Number(a.savedAt||0));

    if (primaries.length) {
      const chosen = primaries[0];
      return { ...chosen, migrationBlocked: !preserveMigration(chosen.raw) };
    }

    const backups = [
      readCandidate(durableBackup, 'indexeddb-backup', true),
      readCandidate(localBackup, 'backup', true)
    ].filter(Boolean).sort((a,b)=>Number(b.savedAt||0)-Number(a.savedAt||0));

    if (backups.length) {
      const chosen = backups[0];
      if (!preserveMigration(chosen.raw)) return {...chosen,migrationBlocked:true};
      chosen.state.records.saveRecoveries = (chosen.state.records.saveRecoveries || 0) + 1;
      return chosen;
    }

    for (const key of LEGACY_SAVE_KEYS) {
      const raw = storageGet(key);
      if (!raw) continue;
      try {
        const parsed = parseSaveText(raw);
        if (!preserveMigration(raw)) return {...parsed,source:key,migrationBlocked:true};
        storageSet(SAVE_KEY, makeEnvelope(parsed.state));
        return { ...parsed, source: key, migrated: true, recovered: false };
      } catch (e) { console.warn(`Could not migrate ${key}`, e); }
    }
    return { state: G.createState(), savedAt: Date.now(), source: localPrimary || localBackup || durablePrimary || durableBackup ? 'unreadable' : 'new', recovered: false };
  }

  let importRecoveryBlocked=false;
  try{const restored=window.WTTNFullBackup.recoverPending(localStorage,{save:SAVE_KEY,backup:BACKUP_KEY,preferences:window.WTTNVisualPreferences.KEY});if(restored)window.WTTNVisualPreferences.adoptPlacements(restored);}catch(err){importRecoveryBlocked=true;console.warn('An interrupted full import needs recovery; the recovery copy is retained.',err);}
  const loaded = await load();
  let state = loaded.state;
  let saveQuarantined = importRecoveryBlocked || loaded.source === 'unreadable' || !!loaded.migrationBlocked;
  let currentDisclosure = D.getDisclosure(state, G);
  let currentUx = U?.getAll(state, G) || {};
  function simulateOfflineWithPresentation(seconds) {
    const visual = window.WTTNSettlementModel;
    const before = visual.derive(state);
    const summary = G.simulateOffline(state, seconds);
    summary.milestones = visual.recapMilestones(before, visual.derive(state));
    return summary;
  }
  let pendingOfflineSummary = null;
  const elapsedSinceSave = Math.max(0, (Date.now() - loaded.savedAt) / 1000);
  if (state.system?.offlineEnabled && elapsedSinceSave >= 5) pendingOfflineSummary = simulateOfflineWithPresentation(elapsedSinceSave);
  G.updatePhase2Completion(state);
  G.updatePhase3Completion(state);
  G.updatePhase4Completion(state);
  G.updatePhase5Completion(state);
  G.updateLibraryUnlocks(state);
  currentDisclosure = D.getDisclosure(state, G);
  currentUx = U?.getAll(state, G) || currentUx;
  M?.ensureLayer?.();
  M?.seed?.(state, G);
  Q?.init?.();
  Q?.seed?.(state, G);
  let buyAmount = '1';
  let lastFrame = performance.now();
  let accumulator = 0;
  let lastUi = 0;
  let toastTimer = null;
  let masteryShown = !!state.phase2Complete;
  let phase3Shown = !!state.phase3Complete;
  let phase4Shown = !!state.phase4Complete;
  let phase5Shown = !!state.phase5Complete;
  let suspendedAt = null;
  let lastFocusedBeforeModal = null;
  let storageAvailable = true;
  let warnedAboutStorage = false;
  let healthCache = { at: 0, value: null };
  let durableStorageActive = String(loaded.source || '').startsWith('indexeddb');
  let saveChain = Promise.resolve(true);


  function modalFocusable(modal) {
    return [...modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.hidden && !el.closest('.hidden') && el.getClientRects().length > 0);
  }

  function setModalBackgroundInert(modal, inert) {
    const parent = modal?.parentElement;
    if (!parent) return;
    for (const child of parent.children) {
      if (child === modal) continue;
      if (inert) {
        child.dataset.modalInert = '1';
        child.inert = true;
        child.setAttribute('aria-hidden', 'true');
      } else if (child.dataset.modalInert === '1') {
        child.inert = false;
        child.removeAttribute('aria-hidden');
        delete child.dataset.modalInert;
      }
    }
  }

  function openModal(id, focusId = null) {
    const modal = $(id);
    if (!modal) return false;
    const alreadyOpen = document.querySelector('.modal-backdrop:not(.hidden)');
    if (alreadyOpen && alreadyOpen !== modal) closeModal(alreadyOpen.id, { restoreFocus: false });
    if (!modal.classList.contains('hidden')) return true;
    if (!document.activeElement?.closest?.('.modal-backdrop')) lastFocusedBeforeModal = document.activeElement;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setModalBackgroundInert(modal, true);
    const target = (focusId && $(focusId)) || modalFocusable(modal)[0] || modal;
    if (target === modal && !modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
    queueMicrotask(() => target.focus?.());
    M?.modalReveal?.(id);
    return true;
  }

  function closeModal(id, { restoreFocus = true } = {}) {
    const modal = $(id);
    if (!modal || modal.classList.contains('hidden')) return false;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    setModalBackgroundInert(modal, false);
    if (!document.querySelector('.modal-backdrop:not(.hidden)')) document.body.classList.remove('modal-open');
    if (restoreFocus) queueMicrotask(() => {
      const origin = lastFocusedBeforeModal;
      if (origin?.isConnected && !origin.closest?.('.hidden')) origin.focus?.();
      else document.querySelector('.tab.active')?.focus?.();
    });
    return true;
  }

  function focusTab(name) {
    document.querySelector(`.tab[data-tab="${name}"]`)?.focus?.();
  }

  function closeModalToTab(id, tab) {
    closeModal(id, { restoreFocus: false });
    switchTab(tab);
    queueMicrotask(() => focusTab(tab));
  }

  function trapModalTab(event) {
    if (event.key !== 'Tab') return false;
    const modal = [...document.querySelectorAll('dialog[open]')].pop() || document.querySelector('.modal-backdrop:not(.hidden)');
    if (!modal) return false;
    const focusable = modalFocusable(modal);
    if (!focusable.length) {
      event.preventDefault();
      modal.focus?.();
      return true;
    }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus(); return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus(); return true;
    }
    if (!modal.contains(document.activeElement)) {
      event.preventDefault(); first.focus(); return true;
    }
    return false;
  }

  function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function updateInstallUi(message = null) {
    const status = $('appInstallStatus');
    const install = $('installAppBtn');
    const installTop = $('installTopBtn');
    const update = $('updateAppBtn');
    const version = $('releaseVersion');
    if (version) version.textContent = `v${APP_VERSION}`;
    if (!status || !install || !update) return;

    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const standalone = isStandalone();
    const online = navigator.onLine !== false;
    const hasUpdate = !!swRegistration?.waiting;

    install.disabled = !deferredInstallPrompt || standalone;
    install.classList.toggle('hidden', standalone);
    installTop?.classList.toggle('hidden', !deferredInstallPrompt || standalone);
    update.classList.toggle('hidden', !hasUpdate);

    if (message) status.textContent = message;
    else if (standalone) status.textContent = `${online ? 'Installed' : 'Installed · offline'} · v${APP_VERSION}`;
    else if (!secure) status.textContent = `Play-ready · installation requires HTTPS · v${APP_VERSION}`;
    else if (!('serviceWorker' in navigator)) status.textContent = `Play-ready · this browser does not support app installation · v${APP_VERSION}`;
    else if (hasUpdate) status.textContent = `Update ready · current release v${APP_VERSION}`;
    else if (deferredInstallPrompt) status.textContent = `Ready to install · ${online ? 'online' : 'offline'} · v${APP_VERSION}`;
    else status.textContent = `Offline shell ${navigator.serviceWorker.controller ? 'active' : 'initializing'} · ${online ? 'online' : 'offline'} · v${APP_VERSION}`;
  }

  async function requestInstall() {
    if (!deferredInstallPrompt) { updateInstallUi('Use your browser’s install/add-to-home-screen menu if available.'); return; }
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await prompt.prompt();
    try { await prompt.userChoice; } catch { /* browser-specific */ }
    updateInstallUi();
  }

  async function registerPwa() {
    if (window.WTTN_PORTABLE) { updateInstallUi('Portable edition: the complete game is in this file. Use the web bundle for installation.'); return; }
    updateInstallUi();
    if (SMOKE_MODE || !('serviceWorker' in navigator)) return;
    if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      const watch = worker => worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) updateInstallUi('A new release is ready. Apply the update when convenient.');
      });
      watch(swRegistration.installing);
      swRegistration.addEventListener('updatefound', () => watch(swRegistration.installing));
      updateInstallUi();
      if (!SMOKE_MODE) setInterval(() => swRegistration?.update().catch(() => {}), 60 * 60 * 1000);
    } catch (err) {
      console.warn('Service worker registration failed', err);
      updateInstallUi('Play-ready · offline installation could not be initialized.');
    }
  }

  function updateSaveStatus(text = 'Saved', kind = '') {
    const el = $('saveStatus');
    if (!el) return;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('dirty', kind === 'dirty');
    el.classList.toggle('error', kind === 'error');
  }

  function setStorageWarning(message = '') {
    const warning = $('storageWarning');
    if (!warning) return;
    $('storageWarningText').textContent = message;
    warning.hidden = !message;
    warning.classList.toggle('hidden', !message);
  }

  function pruneObsoleteSaveCopies() {
    for (const key of LEGACY_SAVE_KEYS) storageRemove(key);
  }

  function finishSaveSuccess(show = false) {
    storageAvailable = true;
    warnedAboutStorage = false;
    state.lastSavedAt = Date.now();
    healthCache.at = 0;
    try {
      setStorageWarning();
      updateSaveStatus('Saved');
      if (show) toast('Saved');
    } catch (error) { console.warn('Save retained; save-status display could not refresh.', error); }
    return true;
  }

  function finishSaveFailure(reason, show = false) {
    storageAvailable = false;
    if (!warnedAboutStorage) { console.warn('Persistent saving is unavailable; export remains available.'); warnedAboutStorage = true; }
    updateSaveStatus('Export-only', 'error');
    setStorageWarning(window.WTTNSaveStorage.message(reason));
    if (show) toast('Could not save persistently');
    return false;
  }

  async function persistDurable(envelope, { backup = true, show = false, localResult = null } = {}) {
    const durable = await window.WTTNSaveStorage.durableCommit(SAVE_KEY, BACKUP_KEY, envelope, { backup });
    if (durable.ok) {
      durableStorageActive = true;
      pruneObsoleteSaveCopies();
      storageRemove(BACKUP_KEY);
      window.WTTNSaveStorage.write(() => window.localStorage, SAVE_KEY, envelope);
      return finishSaveSuccess(show);
    }
    if (localResult?.ok) return true;
    const reason = durable.reason === 'unsupported' ? (localResult?.reason || 'unavailable') : durable.reason;
    return finishSaveFailure(reason || 'unavailable', show);
  }

  function queueDurableSave(envelope, options, localResult) {
    const task = () => persistDurable(envelope, { ...options, localResult });
    saveChain = saveChain.then(task, task);
    return saveChain;
  }

  function save(show = false, { backup = true } = {}) {
    if (saveQuarantined) { updateSaveStatus('Recovery needed', 'error'); return false; }
    let envelope;
    try {
      envelope = makeEnvelope(state);
    } catch {
      updateSaveStatus('Save preparation failed', 'error');
      setStorageWarning(window.WTTNSaveStorage.message('serialization'));
      return false;
    }

    const previous = storageGet(SAVE_KEY);
    let previousIsValid = false;
    let backupCandidate = null;
    if (previous) {
      try {
        parseSaveText(previous);
        previousIsValid = true;
        if (backup) backupCandidate = previous;
      } catch { /* never back up corrupt bytes */ }
    }

    let result = window.WTTNSaveStorage.write(() => window.localStorage, SAVE_KEY, envelope);
    let reclaimedForPrimary = false;
    if (!result.ok && result.reason === 'quota') {
      pruneObsoleteSaveCopies();
      result = window.WTTNSaveStorage.write(() => window.localStorage, SAVE_KEY, envelope);
    }
    if (!result.ok && result.reason === 'quota' && previousIsValid) {
      storageRemove(BACKUP_KEY);
      reclaimedForPrimary = true;
      result = window.WTTNSaveStorage.write(() => window.localStorage, SAVE_KEY, envelope);
    }

    if (result.ok) {
      pruneObsoleteSaveCopies();
      if (backupCandidate && !reclaimedForPrimary && !window.indexedDB) storageSet(BACKUP_KEY, backupCandidate);
      finishSaveSuccess(show);
      if (window.indexedDB) queueDurableSave(envelope, { backup, show: false }, result);
      return true;
    }

    if (window.indexedDB) {
      updateSaveStatus('Saving…', 'dirty');
      queueDurableSave(envelope, { backup, show }, result);
      return true;
    }
    return finishSaveFailure(result.reason, show);
  }

  async function saveAndWait(show = false, options = {}) {
    if (!save(show, options)) return false;
    try { return await saveChain; } catch (error) {
      console.warn('Queued save failed', error);
      return false;
    }
  }

  function saveHealthText(force = false) {
    if (!force && healthCache.value && Date.now() - healthCache.at < 2000) return healthCache.value;
    let primary = 'missing', backup = 'missing';
    try { const raw = storageGet(SAVE_KEY); if (raw) { parseSaveText(raw); primary = 'valid'; } } catch { primary = 'invalid'; }
    if (durableStorageActive) primary = 'valid';
    try { const raw = storageGet(BACKUP_KEY); if (raw) { parseSaveText(raw); backup = 'valid'; } } catch { backup = 'invalid'; }
    healthCache = { at: Date.now(), value: { primary, backup } };
    return healthCache.value;
  }

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function switchTab(id) {
    if (!D.isTabVisible(currentDisclosure, id)) id = currentDisclosure.visibleTabs[0] || 'work';
    let activeTab = null;
    document.querySelectorAll('.tab').forEach(b => {
      const visible = D.isTabVisible(currentDisclosure, b.dataset.tab);
      const active = visible && b.dataset.tab === id;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
      b.setAttribute('tabindex', active ? '0' : '-1');
      if (active) activeTab = b;
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      const paneId = p.id.replace(/^tab-/, '');
      const active = D.isTabVisible(currentDisclosure, paneId) && paneId === id;
      p.classList.toggle('active', active);
      p.hidden = !active;
    });
    if (isNarrowViewport()) safeScrollIntoView(activeTab, { block: 'nearest', inline: 'center' });
    setMobileActionsOpen(false);
    document.body.dataset.activeTab = id;
    if (lastSection !== id) { lastSection = id; window.scrollTo({top:0, behavior:'instant'}); }
    window.WTTNSettlement?.screen(id);
    const labels = {work:'Settlement', projects:'Projects', translation:'Translation', insight:'Translation Insight', network:'Distribution Network', fields:'Mission Fields', legacy:'Legacy', scripture:'Scripture Codex', stats:'Campaign Statistics', system:'Settings & Save Safety'};
    if ($('workspaceTitle')) $('workspaceTitle').textContent = labels[id] || 'Your campaign';
    if (!renderScheduled) { renderScheduled = true; queueMicrotask(() => { renderScheduled = false; render(); }); }
  }


  function refsHtml(refs, label = 'Read') {
    if (!refs || !refs.length) return '';
    return `<div class="scripture-refs" aria-label="Suggested Scripture references"><span>${label}</span>${refs.map(r => `<button class="reference-link" data-read-ref="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('')}</div>`;
  }

  function sourceLinksHtml(sourceIds) {
    if (!sourceIds || !sourceIds.length) return '';
    const links = sourceIds.map(id => K?.SOURCES?.[id]).filter(Boolean).map(src => `<a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(src.publisher)}</a>`).join(' · ');
    return links ? `<div class="history-sources"><span>Source</span>${links}</div>` : '';
  }

  function content(group, id) {
    return C?.[group]?.[id] || null;
  }

  function achievementUnlocked(def) {
    switch (def.condition) {
      case 'firstProject': return Object.values(state.projects || {}).some(Boolean);
      case 'firstTranslation': return state.translations >= 1;
      case 'fullAutomation': return !!state.tiOneTime?.fullAutomation || state.networks > 0 || state.legacies > 0;
      case 'firstNetwork': return state.networks >= 1;
      case 'firstField': return state.field.index >= 1 || state.campaign.tier1 >= 1;
      case 'tier1': return state.campaign.tier1 >= 5;
      case 'firstLegacy': return state.legacies >= 1;
      case 'allFields': return state.field.index >= G.FIELDS.length;
      case 'allLibrary': return G.SCRIPTURE_COLLECTIONS.every(x => !!state.library?.[x.id] || G.scriptureCollectionUnlocked(state, x.id));
      case 'campaignComplete': return !!state.campaign.complete;
      default: return false;
    }
  }

  function achievementHtml(def) {
    const unlocked = achievementUnlocked(def);
    const detail = K?.JOURNAL_DETAILS?.[def.id];
    const expanded = unlocked && detail ? `<div class="journal-memory"><span>${escapeHtml(detail.category || 'MILESTONE')}</span><p>${escapeHtml(detail.memory)}</p></div><details class="journal-reflection"><summary>Reflection</summary><p>${escapeHtml(detail.reflection)}</p></details>` : '';
    return `<article class="achievement-card ${unlocked ? 'unlocked' : 'locked-card'}">
      <div><p class="eyebrow">${unlocked ? 'RECORDED' : 'NOT YET'}</p><h3>${def.name}</h3><p>${def.description}</p>${expanded}</div>
      ${refsHtml([def.reference], 'Read')}
    </article>`;
  }

  function producerHtml(def) {
    const preview=W.purchase(state,def,buyAmount);
    const owned = state.producers[def.id];
    const cost = G.producerCost(def, owned, state);
    const affordable = state.pages.gte(cost);
    const higherIndex = G.PRODUCERS.findIndex(x => x.id === def.id) + 1;
    const higher = G.PRODUCERS[higherIndex];
    const synergy = higher ? (1 + state.producers[higher.id] / 25) ** G.synergyExponent(state, def.id) : 1;
    const maxAllowed = G.hasBuyMax(state);
    const actualBuyAmount = buyAmount === 'max' && !maxAllowed ? '10' : buyAmount;
    const max = actualBuyAmount === 'max' ? G.maxAffordableProducerCount(state, def.id, 100000) : 0;
    const qtyLabel = actualBuyAmount === 'max' ? (max ? `Buy ${max}` : 'Buy max') : actualBuyAmount === '10' ? 'Buy up to 10' : 'Buy 1';
    const specializationCost = state.specialization === 'publisher' ? '<span class="micro-badge">Publisher cost</span>' : '';
    const copy = content('PRODUCERS', def.id);
    return `<article id="producer-${def.id}" class="producer-card ${currentUx?.work?.recommended?.type === 'producer' && currentUx.work.recommended.id === def.id ? 'ux-recommended' : ''}">
      <div class="card-art card-art-producer">${R?.producer?.(def.id) || ''}</div>
      <div class="producer-content">
        <div class="producer-title"><h3>${def.name}</h3><span class="count" aria-label="${owned} owned">${owned}<small> owned</small></span>${specializationCost}</div>
        <p>${copy?.description || def.description}</p>
        <div class="milestone-track" aria-hidden="true"><span style="width:${Math.min(100,owned / ([10,25,50,100,250,500].find(n => n > owned) || Math.ceil((owned + 1) / 500) * 500) * 100)}%"></span></div>

      </div>
      <div class="producer-numbers">
        <div><span>${preview.quantity ? `Cost for ${preview.quantity}` : "Next cost"}</span><strong>${readableAmount(preview.quantity ? preview.cost : cost)} P</strong></div><div><span>Producing</span><strong>${readableAmount(preview.contribution)}/sec</strong></div><div><span>${preview.quantity ? `Gain for ${preview.quantity}` : "Next gain"}</span><strong>+${readableAmount(preview.gain)}/sec</strong></div>
      </div>
      <div class="producer-details">        <p class="next-milestone">${window.WTTNPresentationDisclosure.milestone(state,def.id)}</p><details class="producer-detail"><summary>Reading &amp; estimate</summary><p>${preview.eta>0 && Number.isFinite(preview.eta) ? `Next unit in approximately ${fmtTime(preview.eta)} at current production; purchases and effects can change this.` : "Ready to purchase."}</p><p><strong>Next milestone:</strong> ${window.WTTNPresentationDisclosure.milestone(state,def.id)}</p>${refsHtml(copy?.references)}</details></div>
      <button class="buy-producer ${affordable ? 'primary' : ''}" data-producer="${def.id}" aria-label="${qtyLabel} ${def.name}${actualBuyAmount === '1' ? ` for ${cost.format(2)} Pages` : ''}" aria-disabled="${!affordable}" title="${affordable ? 'Purchase with Pages' : `Requires ${cost.format(2)} Pages`}">${qtyLabel}</button>
    </article>`;
  }

  function upgradeHtml(def) {
    const copy = content('METHODS', def.id);
    const bought = !!state.pageUpgrades[def.id];
    const cost = G.bn(def.cost);
    return `<article id="upgrade-${def.id}" class="upgrade-card ${bought ? 'bought' : ''} ${currentUx?.work?.recommended?.type === 'upgrade' && currentUx.work.recommended.id === def.id ? 'ux-recommended' : ''}">
      <header><div class="card-heading-with-art"><span class="mini-art">${R?.method?.(def.id) || ''}</span><div><p class="eyebrow">METHOD</p><h3>${def.name}</h3></div></div><strong>${bought ? 'Active' : `${readableAmount(cost)} P`}</strong></header>
      <p class="mechanical-effect">${window.WTTNPresentationDisclosure.methodDescription(def)}</p>${copy?.description ? `<details class="flavor-note"><summary>In the workshop</summary><p>${copy.description}</p>${refsHtml(copy.references)}</details>` : ""}
      <button data-upgrade="${def.id}" ${bought || state.pages.lt(cost) ? 'disabled' : ''}>${bought ? 'Purchased' : 'Purchase'}</button>
    </article>`;
  }

  function projectRequirements(def) {
    const items = [];
    if (def.peak) {
      const threshold = G.projectThreshold(state, def.id);
      items.push({ text: `${readableAmount(threshold)} peak P`, met: state.peakPages.gte(threshold) });
    }
    if (def.editors) items.push({ text: `${def.editors} Editors`, met: state.producers.editor >= def.editors });
    if (def.teachers) items.push({ text: `${def.teachers} Teachers`, met: state.producers.teacher >= def.teachers });
    for (const req of def.requires || []) items.push({ text: G.PROJECTS.find(x => x.id === req).name, met: state.projects[req] });
    if (def.id === 'manuscript' && !state.projects.manuscript) items.push({ text: `Invest ${readableAmount(state.pages.mul(Math.min(.2,.2*G.allocationEffects(state).digitalProjectDivisor)))} Pages (current investment)`, met: !state.pages.isZero });
    return items;
  }

  function projectHtml(def){return window.WTTNSecondaryScreens.commission(state,def,readableAmount);}

  function repeatableHtml(def) {
    const copy = C?.TRANSLATION?.repeatables?.[def.id];
    const level = state.tiUpgrades[def.id];
    const cost = G.repeatableCost(state, def.id);
    const maxed = !cost;
    let effect = '';
    if (def.id === 'workflow') effect = `Current: ×${G.workflowMultiplier(state).toFixed(2)} all Pages`;
    if (def.id === 'training') effect = `Current: ×${G.trainingFactor(state).toFixed(2)} synergy exponent`;
    if (def.id === 'preparation') effect = G.preparationEffect(level);
    return `<article id="ti-repeatable-${def.id}" class="upgrade-card insight-card ${maxed ? 'bought' : ''} ${currentUx?.insight?.recommended?.type === 'ti-repeatable' && currentUx.insight.recommended.id === def.id ? 'ux-recommended' : ''}">
      <header><div><p class="eyebrow">REPEATABLE</p><h3>${def.name}</h3></div><strong>Lv ${level}${def.maxLevel ? ` / ${def.maxLevel}` : ''}</strong></header>
      <p class="mechanical-effect">${def.description}</p>${copy?.description ? `<details class="flavor-note"><summary>In the workshop</summary><p>${copy.description}</p>${refsHtml(copy.references)}</details>` : ""}
      <p class="effect-line">${effect}</p>
      <button data-ti-repeatable="${def.id}" ${maxed || state.ti.lt(cost) ? 'disabled' : ''}>${maxed ? 'Maxed' : `Buy · ${cost.format(0)} TI`}</button>
    </article>`;
  }

  function oneTimeHtml(def) {
    const copy = C?.TRANSLATION?.oneTimes?.[def.id];
    const bought = !!state.tiOneTime[def.id];
    const available = G.oneTimeAvailable(state, def.id);
    const prereq = def.requires ? G.TI_ONE_TIMES.find(x => x.id === def.requires)?.name : null;
    return `<article id="ti-onetime-${def.id}" class="upgrade-card insight-card ${bought ? 'bought' : ''} ${!available && !bought ? 'locked-card' : ''} ${currentUx?.insight?.recommended?.type === 'ti-onetime' && currentUx.insight.recommended.id === def.id ? 'ux-recommended' : ''}">
      <header><div><p class="eyebrow">PERMANENT</p><h3>${def.name}</h3></div><strong>${bought ? 'Active' : `${def.cost} TI`}</strong></header>
      <p class="mechanical-effect">${def.description}</p>${copy?.description ? `<details class="flavor-note"><summary>In the workshop</summary><p>${copy.description}</p>${refsHtml(copy.references)}</details>` : ""}
      ${!available && !bought && prereq ? `<p class="lock-note">Requires ${prereq}</p>` : ''}
      <button data-ti-onetime="${def.id}" ${bought || !available || state.ti.lt(def.cost) ? 'disabled' : ''}>${bought ? 'Unlocked' : 'Unlock'}</button>
    </article>`;
  }

  function specializationHtml(def) {
    const copy = C?.TRANSLATION?.specializations?.[def.id];
    const unlocked = G.specializationUnlocked(state);
    const current = state.specialization === def.id;
    const queued = state.queuedSpecialization === def.id;
    const profile = X?.specializationModel?.(state, def.id);
    let label = 'Choose';
    if (current) label = 'Current';
    else if (queued) label = 'Next run';
    else if (state.specialization) label = 'Use next run';
    const live = profile?.live?.map(([k,v]) => `<div><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('') || '';
    return `<article class="specialization-card ${current ? 'selected' : ''} ${queued ? 'queued' : ''}">
      <div><div class="specialization-art">${R?.specialization?.(def.id) || ''}</div><p class="eyebrow">${escapeHtml(profile?.role || 'SPECIALIZATION')}</p><h3>${def.name}</h3><p class="mechanical-effect">${def.description}</p>${copy?.description ? `<details class="flavor-note"><summary>In the workshop</summary><p>${copy.description}</p>${refsHtml(copy.references)}</details>` : ""}
      ${profile ? `<div class="specialization-depth"><p><strong>Best for:</strong> ${escapeHtml(profile.bestFor)}</p><p><strong>Tradeoff:</strong> ${escapeHtml(profile.tradeoff)}</p><div class="live-effect-grid">${live}</div><small>Typical run shape: ${escapeHtml(profile.runWindow)}</small></div>` : ''}</div>
      <button data-specialization="${def.id}" ${!unlocked || current ? 'disabled' : ''}>${label}</button>
    </article>`;
  }

  function recentRunHtml(run, index) {
    const perMin = run.duration > 0 ? run.gain.toNumber() / (run.duration / 60) : 0;
    return `<article class="run-card"><span>#${state.translations - index}</span><strong>+${run.gain.format(0)} TI</strong><small>${fmtTime(run.duration)} · ${perMin.toFixed(2)} TI/min · ${run.automated ? 'Auto' : 'Manual'}${run.specialization ? ` · ${escapeHtml(run.specialization)}` : ''}</small></article>`;
  }

  function presetHtml(p) {
    return `<article class="preset-card">
      <div><span class="eyebrow">SLOT ${p.slot}</span><strong>${p.saved ? escapeHtml(p.specialization || 'No specialization') : 'Empty'}</strong><small>${p.saved ? `${fmtTime(p.auto.minRun)} minimum · ${Number(p.auto.resetMultiple).toFixed(2)}× target` : 'Save the current Translation setup.'}</small></div>
      <div class="preset-actions"><button data-preset-save="${p.slot}">Save</button><button data-preset-load="${p.slot}" ${p.saved ? '' : 'disabled'}>Load</button></div>
    </article>`;
  }

  function networkUpgradeHtml(def) {
    const copy = C?.NETWORK?.upgrades?.[def.id];
    const cost = G.networkUpgradeCost(state, def.id);
    const repeatable = !!def.repeatable;
    const level = repeatable ? state.netUpgrades.infrastructure : null;
    const bought = !repeatable && !!state.netOneTime[def.id];
    const maxed = repeatable && !cost;
    let effect = def.description;
    if (def.id === 'infrastructure') effect = `Current Page multiplier: ×${G.networkInfrastructureMultiplier(state).toFixed(2)}.`;
    return `<article id="network-upgrade-${def.id}" class="upgrade-card insight-card ${bought || maxed ? 'bought' : ''} ${currentUx?.network?.recommended?.id === def.id ? 'ux-recommended' : ''}">
      <header><div><p class="eyebrow">${repeatable ? 'REPEATABLE' : 'NETWORK'}</p><h3>${def.name}</h3></div><strong>${repeatable ? `Lv ${level} / ${def.maxLevel}` : bought ? 'Active' : `${def.cost} NC`}</strong></header>
      <p class="mechanical-effect">${def.description}</p>${copy?.description ? `<details class="flavor-note"><summary>In the workshop</summary><p>${copy.description}</p>${refsHtml(copy.references)}</details>` : ""}<p class="effect-line">${effect}</p>
      <button data-network-upgrade="${def.id}" ${bought || maxed || !cost || state.nc.lt(cost) ? 'disabled' : ''}>${bought ? 'Unlocked' : maxed ? 'Maxed' : `Buy · ${cost.format(0)} NC`}</button>
    </article>`;
  }

  function allocationHtml(def) {
    const copy = C?.NETWORK?.channels?.[def.id];
    const value = Math.round((state.allocation[def.id] || 0) * 100);
    const lim = G.allocationLimits(state);
    const max = def.id === 'local' ? lim.localCap : def.id === 'international' ? lim.internationalCap : lim.cap;
    const min = def.id === 'digital' ? lim.digitalMin : 0;
    return `<article class="panel allocation-card">
      <div><div class="allocation-art">${R?.channel?.(def.id) || ''}</div><p class="eyebrow">CHANNEL</p><h3>${def.name}</h3><p class="mechanical-effect">${def.description}</p>${copy?.description ? `<details class="flavor-note"><summary>In the workshop</summary><p>${copy.description}</p>${refsHtml(copy.references)}</details>` : ""}</div>
      <div class="allocation-control"><button aria-label="Decrease ${def.name} allocation by 5 percent" data-allocation-minus="${def.id}" ${value <= Math.round(min*100) ? 'disabled' : ''}>−5</button><strong>${value}%</strong><button aria-label="Increase ${def.name} allocation by 5 percent" data-allocation-plus="${def.id}" ${value >= Math.round(max*100) ? 'disabled' : ''}>+5</button></div>
    </article>`;
  }

  function recentNetworkHtml(run, index) {
    const a = run.allocation || {};
    const perHour = run.duration > 0 ? run.gain.toNumber() / (run.duration / 3600) : 0;
    const posture = X?.allocationPosture?.(state, a)?.label || 'Network';
    return `<article class="run-card"><span>#${state.networks - index}</span><strong>+${run.gain.format(0)} NC</strong><small>${fmtTime(run.duration)} · ${perHour.toFixed(2)} NC/h · ${escapeHtml(posture)} · L${Math.round((a.local||0)*100)}/R${Math.round((a.regional||0)*100)}/I${Math.round((a.international||0)*100)}/D${Math.round((a.digital||0)*100)}</small></article>`;
  }

  function networkPresetHtml(p) {
    const a = p.allocation || {};
    const summary = p.saved ? `L${Math.round((a.local||0)*100)} · R${Math.round((a.regional||0)*100)} · I${Math.round((a.international||0)*100)} · D${Math.round((a.digital||0)*100)}` : 'Save the current allocation.';
    const metrics = p.saved && X ? X.allocationMetrics(state, a) : null;
    const detail = metrics ? `<small>${escapeHtml(metrics.posture.label)} · Pages ×${metrics.pageMultiplier.toFixed(2)} · TI ×${metrics.international.toFixed(2)} · Projects ${metrics.projectPercent.toFixed(0)}%</small>` : '';
    return `<article class="preset-card"><div><span class="eyebrow">SLOT ${p.slot}</span><strong>${p.saved ? escapeHtml(p.name) : 'Empty'}</strong><small>${summary}</small>${detail}</div><div class="preset-actions"><button data-network-preset-save="${p.slot}">Save</button><button data-network-preset-load="${p.slot}" ${p.saved ? '' : 'disabled'}>Load</button></div></article>`;
  }

  function fieldConstraintItems(field) {
    if (!field) return [];
    const xs = [];
    if (field.pageMultiplier && field.pageMultiplier !== 1) xs.push(`Page production ×${field.pageMultiplier.toFixed(2)}`);
    if (field.directProducerMultiplier && field.directProducerMultiplier !== 1) xs.push(`Direct producers ×${field.directProducerMultiplier.toFixed(2)}`);
    if (field.teacherMultiplier && field.teacherMultiplier !== 1) xs.push(`Teachers ×${field.teacherMultiplier.toFixed(2)}`);
    if (field.projectMultiplier && field.projectMultiplier !== 1) xs.push(`Project effects ×${field.projectMultiplier.toFixed(2)}`);
    if (field.translationThresholdMultiplier && field.translationThresholdMultiplier !== 1) xs.push(`Translation threshold ×${field.translationThresholdMultiplier}`);
    if (field.tiMultiplier && field.tiMultiplier !== 1) xs.push(`Translation Insight ×${field.tiMultiplier.toFixed(2)}`);
    if (field.allocationCap != null) xs.push(`Every allocation ≤ ${Math.round(field.allocationCap*100)}%`);
    if (field.localCap != null) xs.push(`Local ≤ ${Math.round(field.localCap*100)}%`);
    if (field.internationalCap != null) xs.push(`International ≤ ${Math.round(field.internationalCap*100)}%`);
    if (field.digitalMin != null) xs.push(`Digital ≥ ${Math.round(field.digitalMin*100)}%`);
    if (field.autoTranslationTiGate) xs.push(`Auto-Translation gated until ${field.autoTranslationTiGate.toLocaleString()} TI this Network`);
    if (field.preparationCap != null) xs.push(`Effective Preparation capped at Lv${field.preparationCap}`);
    if (field.requireAllProjects) xs.push('All three Projects must be completed');
    return xs;
  }

  function fieldCardHtml(field) {
    const copy = C?.FIELDS?.[field.id];
    const routeStatus = F?.fieldStatus?.(state, G, field) || 'locked';
    const complete = routeStatus === 'complete';
    const current = routeStatus === 'active';
    const available = routeStatus === 'available';
    const locked = routeStatus === 'locked';
    const status = complete ? 'Cleared' : current ? 'Active' : available ? 'Available' : G.fieldLockedReason(state, field);
    const constraints = fieldConstraintItems(field).slice(0,3).join(' · ') || 'Standard rules';
    const strategy = F?.strategyFor?.(field);
    const best = F?.bestHistoryFor?.(state, field.id);
    const archiveUnlocked = G.fieldMasteryStatus(state).tier1.mastered;
    const history = archiveUnlocked && best ? `<small class="field-best">Best clear ${fmtTime(best.duration)}</small>` : '';
    const action = available && G.canEnterField(state, field.id)
      ? `<button class="field-route-enter" data-enter-field="${field.id}">Enter route</button>`
      : '';
    return `<article class="field-card ${complete ? 'cleared' : ''} ${current ? 'active' : ''} ${available ? 'available' : ''} ${locked ? 'locked-card' : ''}" data-field-id="${field.id}">
      <div class="field-emblem">${R?.field?.(field.id) || ''}</div>
      <header><div><p class="eyebrow">TIER ${field.tier}</p><h3>${field.name}</h3></div><strong>${escapeHtml(status)}</strong></header>
      <p>${field.id === 'mature-field' && field.patternId ? field.description : (copy?.narrative || field.description)}</p>${refsHtml(copy?.references)}${copy?.caution ? `<p class="content-caution">${copy.caution}</p>` : ''}
      ${K?.FIELD_DETAILS?.[field.id] ? `<details class="field-context-detail"><summary>Context &amp; abstraction</summary><p><strong>Focus:</strong> ${escapeHtml(K.FIELD_DETAILS[field.id].focus)}</p><p>${escapeHtml(K.FIELD_DETAILS[field.id].reflection)}</p><p class="game-boundary"><strong>Game boundary:</strong> ${escapeHtml(K.FIELD_DETAILS[field.id].abstraction)}</p></details>` : ''}
      ${strategy ? `<div class="field-route-hint"><strong>${escapeHtml(strategy.emphasis)}</strong><span>${escapeHtml(strategy.pressure)}</span></div>` : ''}
      <small>${constraints}</small>${history}
      <div class="field-card-footer"><span>Threshold ${field.ncThreshold} valid NC</span><span>${field.rewardText}</span></div>
      ${action}
    </article>`;
  }

  function recentFieldHtml(run, index) {
    return `<article class="run-card"><span>${escapeHtml(run.name || run.id)}</span><strong>+${run.gain.format(0)} FE</strong><small>${fmtTime(run.duration)} · ${run.validNetworks} valid Networks · ${run.translations} Translations</small></article>`;
  }

  function recentLegacyHtml(run) {
    return `<article class="run-card"><span>Legacy</span><strong>+${run.gain.format(0)} L</strong><small>${fmtTime(run.duration)} · ${run.fe.format(0)} FE · ${run.fieldIndex}/9 canonical Fields</small></article>`;
  }

  function legacyMilestoneHtml(def) {
    const copy = C?.LEGACY?.milestones?.[def.id];
    const active = state.lifetimeLegacy.gte(def.amount);
    return `<article class="upgrade-card insight-card ${active ? 'bought' : 'locked-card'}">
      <header><div class="card-heading-with-art"><span class="mini-seal">${R?.seal?.(def.amount, active ? 'legacy-active' : 'legacy-locked') || ''}</span><div><p class="eyebrow">${def.amount} LIFETIME LEGACY</p><h3>${def.name}</h3></div></div><strong>${active ? 'Active' : `${state.lifetimeLegacy.format(0)} / ${def.amount}`}</strong></header>
      <p class="mechanical-effect">${def.description}</p>${copy?.description ? `<details class="flavor-note"><summary>In the workshop</summary><p>${copy.description}</p>${refsHtml(copy.references)}</details>` : ""}
    </article>`;
  }

  function traditionHtml(def) {
    const copy = C?.LEGACY?.traditions?.[def.id];
    const unlocked = state.legacies > 0;
    const current = state.tradition === def.id;
    const queued = state.queuedTradition === def.id;
    let label = 'Choose';
    if (current) label = 'Current';
    else if (queued) label = 'Next Legacy';
    else if (state.tradition) label = 'Use next Legacy';
    return `<article class="specialization-card tradition-card ${current ? 'selected' : ''} ${queued ? 'queued' : ''}">
      <div><div class="tradition-art">${R?.tradition?.(def.id) || ''}</div><p class="eyebrow">TRADITION</p><h3>${def.name}</h3><p class="mechanical-effect">${def.description}</p>${copy?.description ? `<details class="flavor-note"><summary>In the workshop</summary><p>${copy.description}</p>${refsHtml(copy.references)}</details>` : ""}</div>
      <button data-tradition="${def.id}" ${!unlocked || current ? 'disabled' : ''}>${label}</button>
    </article>`;
  }

  function scriptureCollectionHtml(def) {
    const unlocked = true;
    const copy = C?.LIBRARY?.[def.id];
    const detail = K?.LIBRARY_DETAILS?.[def.id];
    const deepDive = unlocked && detail ? `<details class="library-deep-dive"><summary>${escapeHtml(detail.lens)}</summary><p>${escapeHtml(detail.reflection)}</p>${refsHtml(detail.readingPath, 'Read further')}<div class="library-questions">${(detail.questions || []).map(q => `<p><span>Consider</span>${escapeHtml(q)}</p>`).join('')}</div><p class="game-boundary"><strong>Game boundary:</strong> ${escapeHtml(detail.gameBoundary)}</p></details>` : '';
    return `<article id="scripture-${def.id}" class="scripture-card ${unlocked ? 'unlocked' : 'locked-card'}">
      <div class="library-crest">${R?.library?.(def.id) || ''}</div>
      <header><div><p class="eyebrow">${unlocked ? 'UNLOCKED' : 'LOCKED'}</p><h3>${def.name}</h3></div><strong>${unlocked ? 'Available' : '—'}</strong></header>
      <p>${copy?.summary || def.description}</p>${refsHtml(copy?.references, 'Suggested reading')}
      <div class="scripture-role"><span>Campaign role</span><strong>${copy?.campaignRole || def.role}</strong></div>${deepDive}
    </article>`;
  }

  function renderLegacy() {
    const unlocked = state.phase4Complete || state.legacies > 0 || G.legacyReady(state);
    $('legacyLocked').classList.toggle('hidden', unlocked);
    $('legacyContent').classList.toggle('hidden', !unlocked);
    if (!unlocked) return;
    const gain = G.legacyGain(state);
    const ready = gain.gte(1);
    const readiness = G.legacyReadiness(state);
    $('legacyValue').textContent = `${state.legacy.format(0)} L`;
    $('legacyLifetime').textContent = `${state.lifetimeLegacy.format(0)} L`;
    $('legacyEraFe').textContent = `${state.feThisLegacy.format(0)} / ${G.LEGACY_UNLOCK_FE.format(0)} FE`;
    $('legacyCount').textContent = String(state.legacies);
    $('legacyGain').textContent = gain.format(0);
    $('legacyReadinessLabel').textContent = readiness.label;
    $('legacyReadinessText').textContent = readiness.recommendation;
    $('legacyReadinessBox').dataset.status = readiness.status;
    paint($('legacyEfficiencyBox'), () => `<div><span>Gain rate</span><strong>${G.legacyEfficiency(state).toFixed(2)} L/day</strong></div><div><span>Readiness</span><strong>${Math.round(readiness.factor * 100)}%</strong></div><div><span>Formula</span><strong>(FE / ${G.LEGACY_UNLOCK_FE.format(0)})<sup>${G.LEGACY_EXPONENT.toFixed(2)}</sup> × ${G.LEGACY_SCALE}</strong></div><div><span>Network threshold</span><strong>${G.effectiveNetworkThreshold(state).format(0)} TI</strong></div>`);
    $('legacyResetBtn').disabled = !ready;
    $('legacyResetBtn').textContent = ready ? `Establish Legacy · +${gain.format(0)} L` : 'Establish Legacy';
    $('bestLegacyGain').textContent = `${state.records.bestLegacyGain.format(0)} L`;
    $('fastestLegacy').textContent = fmtTime(state.records.fastestLegacy);
    $('legacyRunTime').textContent = fmtTime(state.legacyRunTime);
    $('legacyPower').textContent = `×${G.legacyPowerMultiplier(state).toFixed(2)}`;
    paint($('legacyMilestoneGrid'), () => G.LEGACY_MILESTONES.map(legacyMilestoneHtml).join(''));
    paint($('traditionGrid'), () => G.TRADITIONS.map(traditionHtml).join(''));
    $('traditionHint').textContent = state.legacies < 1 ? 'Complete your first Legacy to choose a Tradition.' : state.tradition ? `Current: ${G.traditionDef(state.tradition)?.name || state.tradition}. Changes take effect after the next Legacy.` : 'Choose a Tradition for this Legacy cycle.';
    if ($('legacyStrategyBoard') && L) {
      const plan = L.legacyPlan(state, G);
      const campaign = L.campaignPlan(state, G);
      const cycle = plan.mature;
      const nextMilestone = plan.next;
      $('legacyStrategyStatus').textContent = plan.readiness?.label || 'Building';
      $('legacyStrategyStatus').dataset.status = plan.readiness?.status || 'locked';
      paint($('legacyStrategyBoard'), () => `
        <article class="legacy-strategy-card tradition-focus"><span class="eyebrow">TRADITION</span><strong>${escapeHtml(plan.profile.title)}</strong><p>${escapeHtml(plan.profile.strength)}</p><small>${escapeHtml(plan.profile.note)}</small></article>
        <article class="legacy-strategy-card"><span class="eyebrow">NEXT LEGACY MILESTONE</span><strong>${nextMilestone ? `${nextMilestone.amount} L · ${escapeHtml(nextMilestone.name)}` : 'All Legacy milestones active'}</strong><p>${nextMilestone ? `${nextMilestone.remaining.toFixed(0)} lifetime Legacy remaining.` : 'Focus on campaign completion and Mature-cycle mastery.'}</p></article>
        <article class="legacy-strategy-card mature-pattern-card"><span class="eyebrow">NEXT MATURE PATTERN</span><strong>${cycle ? escapeHtml(cycle.field.name.replace('Mature Field · ','')) : 'Canonical Fields first'}</strong><p>${cycle ? escapeHtml(cycle.strategy.pressure) : 'Master all nine canonical Fields to begin repeatable Mature cycles.'}</p><small>${cycle ? escapeHtml(cycle.strategy.approach) : ''}</small></article>
        <article class="legacy-strategy-card"><span class="eyebrow">MATURE CYCLE SET</span><strong>${campaign.mature.current} / ${campaign.mature.target}</strong><p>${campaign.mature.met ? 'A complete four-pattern Mature cycle has been demonstrated.' : 'Complete each Mature pattern once before the final campaign sequence.'}</p></article>
        <article class="legacy-strategy-card primary-plan"><span class="eyebrow">CURRENT PLAN</span><strong>${escapeHtml(plan.action)}</strong><p>${escapeHtml(plan.reason)}</p></article>`);
    }
    const reqs = [
      { label: 'Lifetime Legacy', value: `${state.lifetimeLegacy.format(0)} / ${G.CAMPAIGN_LEGACY_TARGET.format(0)}`, met: state.lifetimeLegacy.gte(G.CAMPAIGN_LEGACY_TARGET) },
      { label: 'Tier I Fields', value: `${state.campaign.tier1} / 5`, met: state.campaign.tier1 >= 5 },
      { label: 'Tier II Fields', value: `${state.campaign.tier2} / 3`, met: state.campaign.tier2 >= 3 },
      { label: 'Tier III Fields', value: `${state.campaign.tier3} / 1`, met: state.campaign.tier3 >= 1 },
      { label: 'Mature cycle set', value: `${Math.min(state.field.matureClears, G.MATURE_FIELD_PATTERNS.length)} / ${G.MATURE_FIELD_PATTERNS.length}`, met: state.field.matureClears >= G.MATURE_FIELD_PATTERNS.length }
    ];
    paint($('campaignRequirements'), () => reqs.map(r => `<div class="campaign-requirement ${r.met ? 'met' : ''}"><span>${r.met ? '✓' : '○'} ${r.label}</span><strong>${r.value}</strong></div>`).join(''));
    const finalReady = G.finalSequenceAvailable(state);
    $('completeCampaignBtn').disabled = !finalReady || state.campaign.complete;
    $('completeCampaignBtn').textContent = state.campaign.complete ? 'Campaign complete' : finalReady ? 'Complete “To Every Nation”' : 'Final sequence locked';
    $('recentLegaciesSection').classList.toggle('hidden', state.records.recentLegacies.length === 0);
    if (state.records.recentLegacies.length) paint($('recentLegacies'), () => state.records.recentLegacies.map(recentLegacyHtml).join(''));
  }

  function renderScripture() {
    codex.render();
    G.updateLibraryUnlocks(state);
    const unlocked = G.SCRIPTURE_COLLECTIONS.filter(c => state.library?.[c.id]).length;
    $('librarySummary').textContent = `All Scripture readings are available. ${unlocked} campaign reflections discovered.`;
    paint($('scriptureGrid'), () => G.SCRIPTURE_COLLECTIONS.map(scriptureCollectionHtml).join(''));
    if ($('historyContextGrid')) paint($('historyContextGrid'), () => (K.HISTORICAL_NOTES || []).map(note => `<article class="history-context-card"><div class="history-context-head"><span>${escapeHtml(note.era)}</span><strong>HISTORY</strong></div><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p>${sourceLinksHtml(note.sourceIds)}</article>`).join(''));
    if ($('guardrailGrid')) paint($('guardrailGrid'), () => (K.GUARDRAILS || []).map(g => `<article class="guardrail-card"><span aria-hidden="true">—</span><div><strong>${escapeHtml(g.title)}</strong><p>${escapeHtml(g.body)}</p></div></article>`).join(''));
    if ($('terminologyGrid')) paint($('terminologyGrid'), () => Object.entries(C.TERMINOLOGY || {}).map(([term, meaning]) => `<article class="term-card"><strong>${term}</strong><p>${meaning}</p></article>`).join(''));
    if ($('achievementGrid')) paint($('achievementGrid'), () => (C.ACHIEVEMENTS || []).map(achievementHtml).join(''));
    if ($('journalSummary')) {
      const achieved = (C.ACHIEVEMENTS || []).filter(achievementUnlocked).length;
      $('journalSummary').textContent = `${achieved} / ${(C.ACHIEVEMENTS || []).length} milestones recorded`;
    }
  }

  function renderFields() {
    const unlocked = state.phase3Complete || state.field.active || state.field.index > 0 || G.fieldUnlocked(state);
    $('fieldsLocked').classList.toggle('hidden', unlocked);
    $('fieldsContent').classList.toggle('hidden', !unlocked);
    if (!unlocked) return;

    const route = F?.routeState?.(state, G);
    const field = G.currentField(state) || G.nextField(state);
    const active = !!G.currentField(state);
    const objectives = active ? G.fieldObjectiveStatus(state) : { met: false, items: [] };
    const gain = active ? G.fieldReward(state) : field ? G.fieldThreshold(state, field).pow(0.35).mul(field.difficulty * G.FIELD_REWARD_SCALE).floor().max(1) : G.bn(0);
    const mastery = G.fieldMasteryStatus(state);
    const bottleneck = F?.bottleneck?.(state, G, active ? field : null);

    $('fieldFe').textContent = `${state.fe.format(0)} FE`;
    $('fieldLifetimeFe').textContent = `${state.lifetimeFe.format(0)} FE`;
    $('fieldLegacyFe').textContent = `${state.feThisLegacy.format(0)} / ${G.LEGACY_UNLOCK_FE.format(0)} FE`;
    $('fieldClearCount').textContent = state.field.matureClears ? `${state.field.index} / ${G.FIELDS.length} · ${state.field.matureClears} Mature` : `${state.field.index} / ${G.FIELDS.length}`;

    if ($('fieldRouteBoard') && route) {
      const available = route.available.filter(f => !f.repeatable).map(f => `<span>${escapeHtml(f.name)}</span>`).join('') || (route.canonicalMastered ? '<span>Mature Field</span>' : '<span>No new route currently available</span>');
      paint($('fieldRouteBoard'), () => `<div class="field-route-copy"><p class="eyebrow">ROUTE PLANNER</p><h2>Choose the next context deliberately.</h2><p>${escapeHtml(route.nextUnlock)}</p></div>
        <div class="field-tier-track">
          <div class="${route.tier2Unlocked ? 'unlocked' : ''}"><span>Tier I</span><strong>${route.counts.tier1}/5</strong><small>Any 3 open Tier II · all 5 master the tier</small></div>
          <div class="${route.tier3Unlocked ? 'unlocked' : ''}"><span>Tier II</span><strong>${route.counts.tier2}/3</strong><small>Any 2 open Frontier III · all 3 master the tier</small></div>
          <div class="${route.mastery.tier3.mastered ? 'unlocked' : ''}"><span>Tier III</span><strong>${route.counts.tier3}/1</strong><small>Seal Frontier III</small></div>
        </div>
        <div class="field-mastery-track">
          <span class="${mastery.tier1.mastered ? 'mastered' : ''}">Tier I mastery · ${mastery.tier1.reward}</span>
          <span class="${mastery.tier2.mastered ? 'mastered' : ''}">Tier II mastery · ${mastery.tier2.reward}</span>
          <span class="${mastery.tier3.mastered ? 'mastered' : ''}">Canonical mastery · ${mastery.tier3.reward}</span>
        </div>
        <div class="field-available-routes"><small>Available now</small>${available}</div>`);
    }

    $('currentFieldName').textContent = field ? field.name : 'All Fields cleared';
    $('fieldTierLabel').textContent = field ? `${active ? 'ACTIVE' : 'RECOMMENDED'} · TIER ${field.tier}` : 'CAMPAIGN COMPLETE';
    $('currentFieldDescription').textContent = field ? (field.id === 'mature-field' && field.patternId ? field.description : (C?.FIELDS?.[field.id]?.narrative || field.description)) : 'The designed Mission Field campaign is complete.';
    const strategy = field ? F?.strategyFor?.(field) : null;
    if ($('fieldStrategyBriefing')) paint($('fieldStrategyBriefing'), () => strategy
      ? `<span class="eyebrow">FIELD BRIEFING</span><strong>${escapeHtml(strategy.pressure)}</strong><p>${escapeHtml(strategy.approach)}</p>`
      : '');
    paint($('fieldConstraintList'), () => field ? fieldConstraintItems(field).map(x => `<span>${x}</span>`).join('') : '');
    paint($('fieldObjectiveList'), () => active
      ? objectives.items.map(x => `<div class="field-objective ${x.met ? 'met' : ''}"><span>${x.met ? '✓' : '○'}</span><strong>${x.label}</strong></div>`).join('')
      : field ? `<div class="field-objective"><strong>${G.fieldThreshold(state, field).format(0)} valid NC · ${field.objective?.validNetworks || 0} valid Networks${field.objective?.translations ? ` · ${field.objective.translations} Translations` : ''}${field.requireAllProjects ? ' · all 3 Projects' : ''}</strong></div>` : '');
    $('fieldGain').textContent = gain.format(0);
    $('fieldGainLabel').textContent = active ? 'Clear reward now (meet all objectives)' : 'Minimum reward at the stated clear conditions';
    $('enterFieldBtn').classList.toggle('hidden', active || !field);
    $('completeFieldBtn').classList.toggle('hidden', !active);
    $('enterFieldBtn').disabled = !field || !G.canEnterField(state, field.id);
    $('enterFieldBtn').textContent = field ? `Enter recommended · ${field.name}` : 'No Field available';
    $('completeFieldBtn').disabled = !active || gain.lt(1);
    $('completeFieldBtn').textContent = active && gain.gte(1) ? `Complete Field · +${gain.format(0)} FE` : 'Complete Mission Field';
    $('fieldRunTime').textContent = active ? fmtTime(state.timePlayed - state.field.enteredAt) : '—';
    $('fieldProgressNc').textContent = active ? `${state.field.progressNc.format(0)} / ${G.fieldThreshold(state).format(0)}` : '—';
    $('fieldValidNetworks').textContent = active ? String(state.field.stats.validNetworks) : '—';
    $('fieldTranslations').textContent = active ? String(state.field.stats.translations) : '—';
    $('fieldProjects').textContent = active ? `${state.field.stats.projects.length} / 3` : '—';
    if ($('fieldBottleneck')) paint($('fieldBottleneck'), () => `<strong>${active ? 'Current bottleneck' : 'Route choice'}</strong><p>${escapeHtml(bottleneck?.label || 'Choose an available Field route.')}</p>${bottleneck?.detail ? `<small>${escapeHtml(bottleneck.detail)}</small>` : ''}`);
    $('fieldRewardTitle').textContent = 'Field reward';
    $('fieldRewardText').textContent = field ? field.rewardText : 'Mature Fields provide renewable FE without additional permanent Field rewards.';
    paint($('fieldGrid'), () => G.FIELDS.map(fieldCardHtml).join('') + (G.fieldMasteryStatus(state).canonical.mastered ? fieldCardHtml(G.matureFieldForState(state)) : ''));

    const lastRun = state.records.recentFields?.[0] || null;
    const debrief = F?.debrief?.(lastRun, G);
    $('fieldDebriefSection')?.classList.toggle('hidden', !debrief);
    if (debrief && $('fieldDebrief')) {
      const advancedDebrief = mastery.tier2.mastered;
      paint($('fieldDebrief'), () => `<div class="field-debrief-lead"><span class="eyebrow">${debrief.tier ? `TIER ${debrief.tier}` : 'FIELD'}</span><h3>${escapeHtml(debrief.name)}</h3><p>${advancedDebrief ? `${escapeHtml(debrief.pressure)} · ${escapeHtml(debrief.emphasis)}` : 'Basic Field record · master Tier II to unlock advanced debrief analysis.'}</p></div>
        <div class="field-debrief-metrics"><div><span>Duration</span><strong>${fmtTime(debrief.duration)}</strong></div><div><span>Valid Networks</span><strong>${debrief.validNetworks}</strong></div><div><span>Translations</span><strong>${debrief.translations}</strong></div>${advancedDebrief ? `<div><span>Final posture</span><strong>${escapeHtml(debrief.allocation)}</strong></div>` : ''}</div>
        <div class="field-debrief-learning"><span>Retained learning</span><strong>${escapeHtml(debrief.learned)}</strong></div>`);
    }

    const legacyRatio = Math.min(1, state.feThisLegacy.toNumber() / G.LEGACY_UNLOCK_FE.toNumber());
    $('legacyProgressText').textContent = `${state.feThisLegacy.format(0)} / ${G.LEGACY_UNLOCK_FE.format(0)} FE`;
    $('legacyProgressBar').style.width = `${legacyRatio*100}%`;
    $('legacyProgressHint').textContent = G.legacyReady(state) ? `Legacy is ready for +${G.legacyGain(state).format(0)} L.` : 'Complete Mission Fields to accumulate Field Experience.';
    $('openLegacyBtn').disabled = !(state.phase4Complete || state.legacies > 0 || G.legacyReady(state));
    $('recentFieldsSection').classList.toggle('hidden', state.records.recentFields.length === 0);
    if (state.records.recentFields.length) paint($('recentFields'), () => state.records.recentFields.map(recentFieldHtml).join(''));
  }

  function adjustAllocation(channel, delta) {
    if (state.networks === 0 && !state.field?.active) return false;
    const keys = ['local','regional','international','digital'];
    const current = { ...state.allocation };
    const limits = G.allocationLimits(state);
    const maxFor = k => k === 'local' ? limits.localCap : k === 'international' ? limits.internationalCap : limits.cap;
    const minFor = k => k === 'digital' ? limits.digitalMin : 0;
    const step = Math.abs(delta);
    if (delta > 0) {
      if (current[channel] + step > maxFor(channel) + 1e-9) return false;
      const donors = keys.filter(k => k !== channel && current[k] - step >= minFor(k) - 1e-9).sort((a,b) => current[b] - current[a]);
      if (!donors.length) return false;
      current[channel] += step; current[donors[0]] -= step;
    } else {
      if (current[channel] - step < minFor(channel) - 1e-9) return false;
      const receivers = keys.filter(k => k !== channel && current[k] + step <= maxFor(k) + 1e-9).sort((a,b) => current[a] - current[b]);
      if (!receivers.length) return false;
      current[channel] -= step; current[receivers[0]] += step;
    }
    return G.setAllocation(state, current);
  }

  function applyAllocationTemplate(id) {
    const allocation = X?.ALLOCATION_TEMPLATES?.[id]?.allocation;
    return allocation ? G.setAllocation(state, allocation) : false;
  }

  function atlasLegendHtml(model) {
    const items = [];
    if (model.stage === 'work') items.push(['page', '1 prepared page', 'origin']);
    if (model.showTranslation) items.push(['translation', `${model.translations} Translation${model.translations === 1 ? '' : 's'}`, 'translation']);
    if (model.showNetwork) items.push(['network', `${model.networks} Network${model.networks === 1 ? '' : 's'}`, 'network']);
    if (model.showFields) items.push(['field', `${model.canonicalCleared} / ${G.FIELDS.length} Fields`, 'field']);
    if (model.showLegacy) items.push(['legacy', `${model.legacies} Legac${model.legacies === 1 ? 'y' : 'ies'}`, 'legacy']);
    if (model.matureClears) items.push(['mature', `${model.matureClears} Mature`, 'mature']);
    return items.map(([,label,tone]) => `<span class="atlas-legend-item" data-tone="${tone}"><i aria-hidden="true"></i>${escapeHtml(label)}</span>`).join('');
  }

  function atlasRouteClass(status) {
    if (status === 'complete') return 'atlas-field-route is-complete';
    if (status === 'active') return 'atlas-field-route is-active';
    if (status === 'next') return 'atlas-field-route is-next';
    if (status === 'available') return 'atlas-field-route is-available';
    return 'atlas-field-route is-locked';
  }

  function atlasFieldNodeHtml(field) {
    const glyph = R?.fieldSymbol?.(field.id) || `<text class="atlas-field-symbol" text-anchor="middle" y="5">${field.tier}</text>`;
    const check = field.status === 'complete' ? '<text class="atlas-field-check" x="15" y="-12" text-anchor="middle">✓</text>' : '';
    const stateLabel = field.status === 'complete' ? 'cleared' : field.status === 'active' ? 'active' : field.status === 'next' ? 'next route' : field.status === 'available' ? 'available' : 'locked';
    const current = ['active','next'].includes(field.status) ? ' aria-current="step"' : '';
    return `<g class="atlas-field-node is-${field.status}" transform="translate(${field.x} ${field.y})" role="button" tabindex="0" data-atlas-field="${escapeHtml(field.id)}" aria-label="${escapeHtml(field.label)}, ${stateLabel}. Open Mission Fields."${current}>
      <circle class="atlas-hit" r="31"></circle>
      <circle class="atlas-field-halo" r="25"></circle>
      <circle class="atlas-field-disc" r="16"></circle>
      ${glyph}${check}
      <text class="atlas-field-label" text-anchor="middle" y="39">${escapeHtml(field.label)}</text>
    </g>`;
  }

  function atlasSvgHtml(model) {
    const a = model.allocation;
    const branchCount = model.translations <= 0 ? 0 : model.translations < 3 ? 1 : model.translations < 8 ? 2 : 3;
    const routeWidth = v => (2.5 + Math.max(0, Math.min(1, v)) * 10).toFixed(2);
    const fieldOrigin = { x: 660, y: 210 };
    const fieldRoutes = model.showFields ? model.fields.map(f => `<path class="${atlasRouteClass(f.status)}" d="M ${fieldOrigin.x} ${fieldOrigin.y} Q ${(fieldOrigin.x+f.x)/2} ${f.y + (f.y < 210 ? 24 : -24)} ${f.x} ${f.y}"></path>`).join('') : '';
    const fieldNodes = model.showFields ? model.fields.map(atlasFieldNodeHtml).join('') : '';
    const legacyRings = model.showLegacy ? [0,1,2].map((n) => {
      const visible = model.legacies > n;
      return `<ellipse class="atlas-legacy-ring ${visible ? 'is-visible' : ''}" cx="916" cy="212" rx="${206+n*22}" ry="${160+n*17}"></ellipse>`;
    }).join('') : '';
    const mature = model.showLegacy && model.canonicalCleared >= G.FIELDS.length ? `<g class="atlas-mature-node ${model.matureClears ? 'is-active' : ''}" transform="translate(1132 366)">
      <circle r="15"></circle><path d="M-6 0h12M0-6v12"></path><text text-anchor="end" x="-24" y="5">Mature ×${model.matureClears}</text>
    </g>` : '';
    const completeFrame = model.complete ? `<rect class="atlas-complete-frame" x="22" y="20" width="1156" height="378" rx="28"></rect><text class="atlas-complete-label" x="1140" y="48" text-anchor="end">TO EVERY NATION · CAMPAIGN RECORD</text>` : '';

    return `<defs>
      <linearGradient id="atlasPaperGlow" x1="0" x2="1"><stop offset="0" stop-color="#fffaf0" stop-opacity=".9"/><stop offset="1" stop-color="#e8dcc5" stop-opacity=".62"/></linearGradient>
      <linearGradient id="atlasRouteGlow" x1="0" x2="1"><stop offset="0" stop-color="#b45b3f"/><stop offset=".55" stop-color="#426e95"/><stop offset="1" stop-color="#805f22"/></linearGradient>
      <filter id="atlasSoftGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g class="atlas-contours" aria-hidden="true">
      <path d="M32 330 C188 250 255 372 402 308 S650 247 785 302 1020 370 1170 286"></path>
      <path d="M54 78 C200 24 285 130 430 84 S670 30 810 83 1030 145 1160 64"></path>
      <path d="M170 390 C270 328 352 394 474 350 S710 330 820 365"></path>
    </g>
    ${!model.showTranslation ? `<g class="atlas-horizon" aria-hidden="true"><path d="M230 210 C370 210 355 130 500 130 S665 280 810 245 1040 160 1110 180" fill="none" stroke="#809178" stroke-width="2" stroke-dasharray="5 8"/><circle cx="480" cy="132" r="16"/><circle cx="720" cy="233" r="16"/><circle cx="963" cy="197" r="16"/><text x="480" y="105" text-anchor="middle">TRANSLATION</text><text x="720" y="283" text-anchor="middle">NETWORK</text><text x="963" y="167" text-anchor="middle">MISSION FIELDS</text><text x="680" y="357" text-anchor="middle">THE PATH AHEAD · NOT YET UNLOCKED</text></g>` : ''}
    ${completeFrame}
    <g class="atlas-origin" transform="translate(84 142)">
      <path class="atlas-page-left" d="M72 50 C42 35 15 34 0 40 V150 C24 143 49 148 72 164 Z"></path>
      <path class="atlas-page-right" d="M72 50 C102 35 129 34 144 40 V150 C120 143 95 148 72 164 Z"></path>
      <path class="atlas-page-spine" d="M72 50V164"></path>
      <circle class="atlas-origin-dot" cx="72" cy="18" r="8"></circle><path class="atlas-origin-line" d="M72 26V50"></path>
      <text class="atlas-origin-label" text-anchor="middle" x="72" y="192">SCRIPTURE WORK</text>
    </g>
    <path class="atlas-main-route ${model.showTranslation ? 'is-visible' : ''}" d="M228 210 C260 210 272 210 308 210"></path>
    ${model.showTranslation ? `<g class="atlas-translation-group">
      <path class="atlas-translation-branch ${branchCount >= 1 ? 'is-visible' : ''}" d="M308 210 Q356 144 406 128"></path>
      <path class="atlas-translation-branch ${branchCount >= 2 ? 'is-visible' : ''}" d="M308 210 Q360 210 416 210"></path>
      <path class="atlas-translation-branch ${branchCount >= 3 ? 'is-visible' : ''}" d="M308 210 Q356 278 406 294"></path>
      <g class="atlas-translation-node ${branchCount >= 1 ? 'is-visible' : ''}" transform="translate(414 126)"><circle r="11"></circle><path d="M-4 0h8"></path></g>
      <g class="atlas-translation-node ${branchCount >= 2 ? 'is-visible' : ''}" transform="translate(424 210)"><circle r="11"></circle><path d="M-4 0h8"></path></g>
      <g class="atlas-translation-node ${branchCount >= 3 ? 'is-visible' : ''}" transform="translate(414 296)"><circle r="11"></circle><path d="M-4 0h8"></path></g>
      <text class="atlas-stage-label" x="354" y="357" text-anchor="middle">TRANSLATION ×${model.translations}</text>
    </g>` : ''}
    ${model.showNetwork ? `<g class="atlas-network-group">
      <path class="atlas-network-entry ${model.networks ? 'is-established' : 'is-horizon'}" d="M424 210 C448 210 464 210 492 210"></path>
      <g class="atlas-network-hub ${model.networks ? 'is-established' : 'is-horizon'}" transform="translate(520 210)"><circle class="hub-outer" r="27"></circle><circle class="hub-inner" r="10"></circle></g>
      <path class="atlas-channel-route channel-local" stroke-width="${routeWidth(a.local)}" d="M542 198 Q574 128 626 88"></path>
      <path class="atlas-channel-route channel-regional" stroke-width="${routeWidth(a.regional)}" d="M547 207 Q588 174 638 164"></path>
      <path class="atlas-channel-route channel-international" stroke-width="${routeWidth(a.international)}" d="M547 216 Q588 247 638 256"></path>
      <path class="atlas-channel-route channel-digital" stroke-width="${routeWidth(a.digital)}" d="M542 224 Q574 294 626 338"></path>
      <g class="atlas-channel-dot channel-local" transform="translate(640 78)"><circle r="8"></circle><text x="16" y="5">Local ${Math.round(a.local*100)}%</text></g>
      <g class="atlas-channel-dot channel-regional" transform="translate(652 160)"><circle r="8"></circle><text x="16" y="5">Regional ${Math.round(a.regional*100)}%</text></g>
      <g class="atlas-channel-dot channel-international" transform="translate(652 260)"><circle r="8"></circle><text x="16" y="5">International ${Math.round(a.international*100)}%</text></g>
      <g class="atlas-channel-dot channel-digital" transform="translate(640 342)"><circle r="8"></circle><text x="16" y="5">Digital ${Math.round(a.digital*100)}%</text></g>
      <text class="atlas-stage-label" x="520" y="355" text-anchor="middle">NETWORK ×${model.networks}</text>
    </g>` : ''}
    ${model.showFields ? `<g class="atlas-fields-group">${fieldRoutes}${fieldNodes}<text class="atlas-stage-label atlas-fields-caption" x="922" y="390" text-anchor="middle">MISSION FIELDS · ${model.canonicalCleared}/${G.FIELDS.length} SEALED</text></g>` : ''}
    ${legacyRings}${mature}
    ${model.showLegacy ? `<g class="atlas-legacy-mark" transform="translate(1135 62)"><circle r="23"></circle><text text-anchor="middle" y="5">L</text><text x="-35" y="44" text-anchor="middle">${model.legacies} LEGACY</text></g>` : ''}`;
  }

  function renderAtlas() {
    if (!A || !$('missionAtlas')) return;
    const pane = $('missionAtlas').closest('.tab-pane');
    if (pane && !pane.classList.contains('active')) return;
    const model = A.getAtlasModel(state, G);
    const sig = A.signature(model);
    $('missionAtlas').dataset.atlasStage = model.stage;
    $('atlasEyebrow').textContent = model.eyebrow;
    $('atlasTitle').textContent = model.title;
    $('atlasNarrative').textContent = model.narrative;
    $('atlasFieldControls').classList.toggle('hidden', !model.showFields);
    if (model.showFields) {
      const current = $('atlasFieldPicker').value;
      paint($('atlasFieldPicker'), () => model.fields.map(field => `<option value="${escapeHtml(field.id)}">${escapeHtml(field.label)} — ${escapeHtml(field.status)}</option>`).join(''));
      if (current && model.fields.some(field => field.id === current)) $('atlasFieldPicker').value = current;
    }
    paint($('atlasLegend'), () => atlasLegendHtml(model));
    $('atlasActionBtn').textContent = model.action.label;
    $('atlasActionBtn').onclick = () => switchTab(model.action.tab);
    $('atlasSvgTitle').textContent = `Living Mission Atlas · ${model.title}`;
    $('atlasSvgDesc').textContent = model.narrative;
    if ($('atlasAccessibleSummary')) {
      const fieldSummary = model.showFields && model.fields?.length
        ? ` Mission Fields: ${model.fields.map(f => `${f.label} ${f.status}`).join('; ')}.`
        : '';
      $('atlasAccessibleSummary').textContent = `Atlas stage: ${model.title}. ${model.narrative}${fieldSummary}`;
    }
    if (sig !== lastAtlasSignature) {
      paint($('atlasSvg'), () => `<title id="atlasSvgTitle">${escapeHtml(`Living Mission Atlas · ${model.title}`)}</title><desc id="atlasSvgDesc">${escapeHtml(model.narrative)}</desc>${atlasSvgHtml(model)}`);
      lastAtlasSignature = sig;
      $('missionAtlas').classList.remove('atlas-state-change');
      void $('missionAtlas').offsetWidth;
      $('missionAtlas').classList.add('atlas-state-change');
    }
  }

  function heroCopyForDisclosure(disclosure) {
    if (state.campaign?.complete) return {
      title: 'The horizon is not the end.',
      description: 'Review the path, Scripture Library, and the systems you built. The completed campaign remains an abstraction of stewardship and infrastructure—not a claim that real mission work is finished.'
    };
    if (disclosure.tabs.legacy) return {
      title: 'Make good work last.',
      description: 'Legacy turns solved systems into durable starting conditions while the remaining campaign asks for long-term judgment. The numbers still describe organizational learning, not spiritual merit.'
    };
    if (disclosure.tabs.fields) return {
      title: 'A different field. A new approach.',
      description: 'Mission Fields now change the rules you have learned. Read each constraint, adapt Translation and Network practice, and carry useful methods forward without treating real cultures as game difficulty tiers.'
    };
    if (disclosure.tabs.network) return {
      title: 'Give the work a wider reach.',
      description: 'Translation practice is mature enough to support distribution. Allocate capacity deliberately, establish Networks when the reset is efficient, and let solved lower work become infrastructure.'
    };
    if (disclosure.tabs.insight) return {
      title: 'Let learning carry forward.',
      description: 'Translation Insight lets successful methods persist across resets. Strengthen workflow, training, preparation, and eventually automation without changing what Scripture itself is worth.'
    };
    return {
      title: 'Begin with a page.',
      description: 'Prepare Scripture work carefully, strengthen the people and methods around it, and bring the first Translation within reach. The game measures stewardship and infrastructure—not spiritual worth or people.'
    };
  }

  function applyDisclosure(disclosure) {
    const previous = currentDisclosure;
    currentDisclosure = disclosure;

    document.querySelectorAll('.tab').forEach(tab => {
      const visible = D.isTabVisible(disclosure, tab.dataset.tab);
      const wasVisible = previous ? D.isTabVisible(previous, tab.dataset.tab) : visible;
      tab.classList.toggle('hidden', !visible);
      tab.setAttribute('aria-hidden', String(!visible));
      if (visible && !wasVisible) {
        tab.classList.add('disclosure-reveal');
        setTimeout(() => tab.classList.remove('disclosure-reveal'), 900);
      }
    });

    const resourceMap = { ti: '.ti-resource', nc: '.network-resource', fe: '.field-resource', legacy: '.legacy-resource' };
    for (const [key, selector] of Object.entries(resourceMap)) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const visible = !!disclosure.resources[key];
      const wasVisible = previous ? !!previous.resources[key] : visible;
      el.classList.toggle('hidden', !visible);
      if (visible && !wasVisible) {
        el.classList.add('disclosure-reveal');
        setTimeout(() => el.classList.remove('disclosure-reveal'), 900);
      }
    }
    $('resourceStack').dataset.count = String(disclosure.visibleResources.length);

    const automationVisible = !!(state.automation?.basic || state.automation?.full || state.automation?.projects || state.automation?.translation);
    $('automationSwitchboardCard').classList.toggle('hidden', !automationVisible);
    const visibleCount = disclosure.visibleTabs.length;
    paint($('shortcutTabsLabel'), () => `<kbd>Alt + number</kbd> Open ${visibleCount} unlocked sections`);

    const activeTab = document.querySelector('.tab.active')?.dataset.tab;
    if (!activeTab || !D.isTabVisible(disclosure, activeTab)) switchTab('work');

    const copy = heroCopyForDisclosure(disclosure);
    $('heroTitle').textContent = copy.title;
    $('heroDescription').textContent = copy.description;
  }

  function renderPrimaryProgress(disclosure, pps, translationGain, translationReadiness, translationThreshold) {
    let eyebrow = 'CURRENT TRANSLATION';
    let ratio = state.peakPages.isZero ? 0 : Math.max(0, Math.min(1, state.peakPages.log10 / translationThreshold.log10));
    let text = `${readableAmount(state.peakPages)} / ${readableAmount(translationThreshold)} peak Pages`;
    let hint = '';

    if (state.campaign?.complete) {
      eyebrow = 'CAMPAIGN'; ratio = 1; text = 'To Every Nation complete'; hint = 'Review the finished campaign or continue exploring the mastered systems.';
    } else if (disclosure.tabs.legacy) {
      eyebrow = 'CURRENT LEGACY ERA';
      const target = G.LEGACY_UNLOCK_FE.toNumber();
      const value = state.feThisLegacy.toNumber();
      ratio = Math.max(0, Math.min(1, target > 0 ? value / target : 0));
      text = `${state.feThisLegacy.format(0)} / ${G.LEGACY_UNLOCK_FE.format(0)} FE`;
      hint = G.legacyReady(state) ? `Legacy ready · +${G.legacyGain(state).format(0)} L available` : 'Complete Mission Fields to establish durable continuity.';
    } else if (disclosure.tabs.fields) {
      eyebrow = state.field?.active ? 'ACTIVE MISSION FIELD' : 'NEXT MISSION FIELD';
      const field = G.currentField(state);
      if (field) {
        const target = G.fieldThreshold(state).toNumber();
        const value = state.field.progressNc.toNumber();
        ratio = Math.max(0, Math.min(1, target > 0 ? value / target : 0));
        text = `${state.field.progressNc.format(0)} / ${G.fieldThreshold(state).format(0)} valid NC`;
        hint = `${field.name} · ${G.fieldObjectiveStatus(state).met ? 'objectives satisfied' : 'adapt the lower layers to its constraints'}`;
      } else {
        ratio = Math.max(0, Math.min(1, state.ncThisField.toNumber()));
        text = `${state.ncThisField.format(0)} / 1 fresh NC`;
        hint = G.canEnterField(state) ? `${G.nextField(state)?.name || 'Next Field'} is ready to enter.` : 'Establish fresh Network Capacity to begin the next Field.';
      }
    } else if (disclosure.tabs.network) {
      if (state.networks === 0) {
        eyebrow = 'FIRST NETWORK';
        const target = G.effectiveNetworkThreshold(state).toNumber();
        const value = state.tiThisNetwork.toNumber();
        ratio = Math.max(0, Math.min(1, target > 0 ? value / target : 0));
        text = `${state.tiThisNetwork.format(0)} / ${G.effectiveNetworkThreshold(state).format(0)} TI earned this cycle`;
        hint = G.networkGain(state).gte(1) ? `Network ready · +${G.networkGain(state).format(0)} NC available` : 'Keep developing Translation practice; only earned TI advances this boundary.';
      } else {
        eyebrow = 'NETWORK MATURITY';
        const target = G.FIELD_UNLOCK_LIFETIME_NC.toNumber();
        const value = state.lifetimeNc.toNumber();
        ratio = Math.max(0, Math.min(1, target > 0 ? value / target : 0));
        text = `${state.lifetimeNc.format(0)} / ${G.FIELD_UNLOCK_LIFETIME_NC.format(0)} lifetime NC`;
        hint = 'Strengthen the Network. A new strategic layer will reveal itself when capacity is mature enough.';
      }
    } else {
      const earlyGuide = E?.getGuide?.(state, G);
      if (earlyGuide?.active) hint = `${earlyGuide.chapter} · ${earlyGuide.title}`;
      else if (translationGain.gte(1)) hint = `${translationGain.format(0)} TI available · ${translationReadiness.label}`;
      else if (pps.gt(0) && state.pages.lt(translationThreshold)) {
        const needed = translationThreshold.sub(state.pages).toNumber();
        const rate = pps.toNumber();
        const seconds = Number.isFinite(needed / rate) ? needed / rate : Infinity;
        hint = Number.isFinite(seconds) && seconds < 86400 ? `Static ETA at current rate: ${fmtTime(seconds)}` : 'Keep developing production.';
      } else hint = 'Build the production chain.';
    }

    $('progressEyebrow').textContent = eyebrow;
    $('translationProgress').style.width = `${ratio * 100}%`;
    $('translationProgressText').textContent = text;
    $('translationEta').textContent = hint;
  }

  function renderLayerStatus() {
    const disclosure = currentDisclosure;
    let title = 'Discover Translation';
    let text = 'Build the production chain and complete your first Translation.';
    let horizon = 'Next milestone: reach the Translation threshold. Later systems stay out of the way until they become relevant.';
    const earlyGuide = E?.getGuide?.(state, G);
    if (earlyGuide?.active) {
      title = earlyGuide.title;
      text = earlyGuide.summary;
      horizon = earlyGuide.tip;
    }

    if (disclosure.tabs.insight) {
      title = 'Develop Translation practice';
      text = 'Invest Translation Insight into repeatable knowledge and permanent methods.';
      horizon = state.tiOneTime?.translationAutomation
        ? 'Translation practice is mature enough to support a new kind of infrastructure.'
        : 'Build toward specialization, retained preparation, and automation.';
    }
    if (disclosure.tabs.network) {
      title = state.networks > 0 ? 'Develop the Network' : 'Prepare a Distribution Network';
      text = state.networks > 0
        ? 'Allocate distribution capacity, buy persistent infrastructure, and decide when each Network reset is worth taking.'
        : 'The Translation loop is operational. Accumulate earned TI and establish the first Network when the reset is efficient.';
      horizon = state.networks === 0
        ? `Current boundary: ${state.tiThisNetwork.format(0)} / ${G.effectiveNetworkThreshold(state).format(0)} TI earned this cycle.`
        : 'Mature the Network; the next strategic layer will reveal itself when capacity is sufficient.';
    }
    if (disclosure.tabs.fields) {
      title = G.currentField(state)?.name || 'Mission Fields';
      text = G.currentField(state)?.description || 'Use mature lower layers inside rule-changing Field challenges.';
      horizon = G.currentField(state)
        ? `Active objective: ${state.field.progressNc.format(0)} / ${G.fieldThreshold(state).format(0)} valid NC plus the listed Field conditions.`
        : `${G.nextField(state)?.name || 'Mature Field'} is ${G.canEnterField(state) ? 'ready to enter' : 'waiting for fresh Field-cycle Network Capacity'}.`;
    }
    if (disclosure.tabs.legacy) {
      title = state.legacies > 0 ? 'Build enduring Legacy' : 'Legacy is ready';
      text = state.legacies > 0
        ? `${state.lifetimeLegacy.format(0)} lifetime Legacy. Compress solved systems while finishing the Field campaign.`
        : `Convert this era into +${G.legacyGain(state).format(0)} permanent Legacy.`;
      horizon = G.finalSequenceAvailable(state)
        ? 'All campaign requirements are complete. The final sequence is ready.'
        : `Current Legacy era: ${state.feThisLegacy.format(0)} / ${G.LEGACY_UNLOCK_FE.format(0)} FE.`;
    }
    if (G.finalSequenceAvailable(state)) { title = 'Final sequence ready'; text = 'All campaign requirements are complete. “To Every Nation” can now be concluded.'; horizon = 'The final action is available in Legacy.'; }
    if (state.campaign.complete) { title = 'Campaign complete'; text = 'The designed progression arc is complete. Review the Scripture Library or continue exploring the finished systems.'; horizon = 'No further progression layer is hidden beyond the ending.'; }

    const visualLayer = disclosure.stage;
    const phaseIndex = Math.max(0, ['work','translation','network','field','legacy','complete'].indexOf(visualLayer));
    document.querySelectorAll('.rail-journey li').forEach((li, index) => {
      const active = index === Math.min(phaseIndex,4); li.classList.toggle('current', active);
      if (active) li.setAttribute('aria-current','step'); else li.removeAttribute('aria-current');
    });
    document.body.dataset.layer = visualLayer;
    $('layerStatusTitle').textContent = title;
    $('layerStatusText').textContent = text;
    $('networkPreview').textContent = horizon;
  }

  function renderAutomationControls() {
    const controls = state.automation.controls || { baseEnabled: true, projectsEnabled: true, translationEnabled: true };
    const statuses = [
      ['Early producers', state.automation.basic && controls.baseEnabled !== false, state.automation.basic && controls.baseEnabled === false ? 'Paused in System' : 'Basic Automation'],
      ['All production', state.automation.full && controls.baseEnabled !== false, state.automation.full && controls.baseEnabled === false ? 'Paused in System' : 'Full Production Automation'],
      ['Projects', state.automation.projects && controls.projectsEnabled !== false, state.automation.projects && controls.projectsEnabled === false ? 'Paused in System' : 'Project Queue'],
      ['Translation resets', state.automation.translation && controls.translationEnabled !== false && G.autoTranslationAllowed(state), state.automation.translation && controls.translationEnabled === false ? 'Paused in System' : state.automation.translation && !G.autoTranslationAllowed(state) ? 'Field gate active' : 'Translation Automation']
    ];
    paint($('automationStatus'), () => statuses.map(([label, on, source]) => `<div><span>${label}</span><strong class="${on ? 'on' : 'off'}">${on ? 'Automated' : 'Manual'}</strong><small>${source}</small></div>`).join(''));

    const unlocked = state.automation.translation;
    for (const id of ['autoEnabled','autoMinRun','autoMultiple','autoMaxRun']) $(id).disabled = !unlocked;
    const settings = state.automation.autoSettings;
    if (document.activeElement !== $('autoEnabled')) $('autoEnabled').checked = settings.enabled;
    if (document.activeElement !== $('autoMinRun')) $('autoMinRun').value = settings.minRun;
    if (document.activeElement !== $('autoMultiple')) $('autoMultiple').value = settings.resetMultiple;
    if (document.activeElement !== $('autoMaxRun')) $('autoMaxRun').value = settings.maxRun;
    $('autoMinLabel').textContent = fmtTime(settings.minRun);
    $('autoMultipleLabel').textContent = `${Number(settings.resetMultiple).toFixed(2)}×`;
    $('autoMaxLabel').textContent = fmtTime(settings.maxRun);
    $('autoTranslationCard').classList.toggle('locked-card', !unlocked);
  }

  function renderSystem() {
    const controls = state.automation.controls || {};
    if (document.activeElement !== $('controlBaseAutomation')) $('controlBaseAutomation').checked = controls.baseEnabled !== false;
    if (document.activeElement !== $('controlProjectAutomation')) $('controlProjectAutomation').checked = controls.projectsEnabled !== false;
    if (document.activeElement !== $('controlTranslationAutomation')) $('controlTranslationAutomation').checked = controls.translationEnabled !== false;
    $('controlBaseAutomation').disabled = !(state.automation.basic || state.automation.full);
    $('controlProjectAutomation').disabled = !state.automation.projects;
    $('controlTranslationAutomation').disabled = !state.automation.translation;
    if (document.activeElement !== $('offlineEnabled')) $('offlineEnabled').checked = state.system?.offlineEnabled !== false;
    if (document.activeElement !== $('offlineCap')) $('offlineCap').value = String(state.system?.offlineCapSeconds || 14 * 86400);
    if (document.activeElement !== $('keyboardShortcuts')) $('keyboardShortcuts').checked = state.system?.keyboardShortcuts !== false;
    if (document.activeElement !== $('confirmEarlyResets')) $('confirmEarlyResets').checked = state.system?.confirmEarlyResets !== false;
    if ($('motionPreference') && document.activeElement !== $('motionPreference')) $('motionPreference').value = uiPrefs.motion;
    if ($('textScale') && document.activeElement !== $('textScale')) $('textScale').value = uiPrefs.textScale;
    if ($('contrastPreference') && document.activeElement !== $('contrastPreference')) $('contrastPreference').value = uiPrefs.contrast;
    const health = saveHealthText();
    const healthEl = $('saveHealth');
    healthEl.className = `save-health ${health.primary === 'valid' ? 'ok' : 'warn'}`;
    healthEl.textContent = `Primary: ${health.primary}. Recovery backup: ${health.backup}. ${loaded.recovered ? 'This session was recovered from backup. ' : ''}${state.records.saveRecoveries ? `${state.records.saveRecoveries} recovery event${state.records.saveRecoveries === 1 ? '' : 's'} recorded.` : ''}`;
    $('restoreBackupBtn').disabled = health.backup !== 'valid';
  }

  function decisionMetricHtml(metric) {
    const [label, value, dynamic] = metric;
    const shown = dynamic === 'runTime' ? fmtTime(state.runTime) : value;
    return `<div class="decision-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(shown)}</strong></div>`;
  }

  function decisionCockpitHtml(model) {
    if (!model) return '';
    const action = model.action || {};
    const attrs = [action.producer ? `data-quick-producer="${escapeHtml(action.producer)}" ${action.affordable ? '' : 'disabled'}` : '', action.tab ? `data-ux-tab="${escapeHtml(action.tab)}"` : '', action.target ? `data-ux-target="${escapeHtml(action.target)}"` : ''].filter(Boolean).join(' ');
    return `<div class="decision-copy"><p class="eyebrow">${escapeHtml(model.eyebrow || 'PRIMARY DECISION')}</p><h2>${escapeHtml(model.question || '')}</h2><p>${escapeHtml(model.summary || '')}</p></div>
      <div class="decision-side"><div class="decision-metrics">${(model.metrics || []).map(decisionMetricHtml).join('')}</div>${action.label ? `<button class="decision-action ${model.tone === 'ready' ? 'primary' : ''}" ${attrs}>${escapeHtml(action.label)}</button>` : ''}</div>`;
  }


  function renderEarlyJourney() {
    const panel = $('earlyJourney');
    if (!panel || !E) return;
    const guide = E.getGuide(state, G);
    panel.classList.toggle('hidden', !guide.active);
    if (!guide.active) return;
    $('earlyJourneyTitle').textContent = guide.title;
    $('earlyJourneyChapter').textContent = guide.chapter;
    $('earlyJourneySummary').textContent = guide.summary;
    $('earlyJourneyTip').textContent = guide.tip || '';
    paint($('earlyJourneyMetrics'), () => (guide.metrics || []).map(([label,value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join(''));
    paint($('earlyJourneyRail'), () => (guide.chapters || []).map((ch, i) => `<li class="${escapeHtml(ch.state)}"><span>${i + 1}</span><strong>${escapeHtml(ch.label)}</strong></li>`).join(''));
    panel.dataset.tone = guide.tone || 'neutral';
    const action = $('earlyJourneyAction');
    action.textContent = guide.action?.label || 'Focus objective';
    action.onclick = () => {
      if (guide.action?.tab) switchTab(guide.action.tab);
      queueMicrotask(() => {
        const target = guide.action?.target ? $(guide.action.target) : null;
        safeScrollIntoView(target, { block:'center' });
        if (target?.matches?.('button:not([disabled]), [tabindex]')) target.focus?.();
      });
    };
  }

  function renderDecisionCockpits() {
    currentUx = U?.getAll(state, G) || {};
    const map = { work:'workDecisionCockpit', projects:'projectsDecisionCockpit', translation:'translationDecisionCockpit', insight:'insightDecisionCockpit', network:'networkDecisionCockpit', fields:'fieldsDecisionCockpit', legacy:'legacyDecisionCockpit' };
    for (const [key,id] of Object.entries(map)) {
      const el = $(id); if (!el) continue;
      const early = key === 'work' && E?.getGuide(state, G);
      let model = early?.active ? {eyebrow:'NEXT STEP', question:early.title, summary:early.summary, action:{label:early.action?.label || 'Review production', tab:early.action?.tab, target:early.action?.target}, tone:early.tone} : currentUx[key];
      const nextProducer = early?.active && early.action?.target?.startsWith('producer-') ? early.action.target.slice(9) : null;
      if (nextProducer && G.PRODUCERS.some(p => p.id === nextProducer)) {
        const def = G.PRODUCERS.find(p => p.id === nextProducer);
        const price = G.producerCost(def, state.producers[nextProducer], state);
        model = {...model, action:{label:`Buy ${def.name} · ${readableAmount(price)} P`, producer:nextProducer, affordable:state.pages.gte(price)}};
      }
      paint(el, () => decisionCockpitHtml(model));
      el.dataset.tone = currentUx[key]?.tone || 'neutral';
    }
    document.querySelectorAll('[data-ux-tab],[data-ux-target]').forEach(btn => btn.onclick = () => {
      if (btn.dataset.uxTab) switchTab(btn.dataset.uxTab);
      queueMicrotask(() => {
        const target = btn.dataset.uxTarget ? $(btn.dataset.uxTarget) : null;
        safeScrollIntoView(target, { block: 'center' });
        if (target?.matches?.('button:not([disabled]), [tabindex]')) target.focus?.();
      });
    });
    document.querySelectorAll('[data-section-target]').forEach(btn => btn.onclick = () => safeScrollIntoView($(btn.dataset.sectionTarget), { block:'start' }));
  }

  function depthMetric(label, value) {
    return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function renderTranslationDepth() {
    const el = $('translationDepthPanel');
    if (!el || !X) return;
    const visible = state.translations > 0;
    el.classList.toggle('hidden', !visible);
    if (!visible) return;
    const model = X.translationResetModel(state);
    const recent = model.recentBest ? `${(model.recentBest*60).toFixed(2)} TI/min` : 'No baseline yet';
    const tone = model.action === 'reset' ? 'ready' : model.action === 'consider' ? 'consider' : 'wait';
    el.dataset.tone = tone;
    paint(el, () => `<div class="midgame-depth-copy"><p class="eyebrow">RESET PLANNER · ${escapeHtml(model.specialization.name.toUpperCase())}</p><h2>${model.action === 'reset' ? 'This run is reset-efficient.' : model.action === 'consider' ? 'Reset is viable, but not pace-leading.' : 'This run is still developing.'}</h2><p>${escapeHtml(model.reason)}</p><small>${escapeHtml(model.specialization.role)} · preferred shape ${escapeHtml(model.specialization.runWindow)}</small></div><div class="midgame-depth-metrics">${depthMetric('Gain now', `${model.gain.toFixed(0)} TI`)}${depthMetric('Current pace', `${(model.currentPerSec*60).toFixed(2)} TI/min`)}${depthMetric('Recent best', recent)}${depthMetric('Readiness', `${Math.round(model.readiness.score*100)}%`)}</div>`);
  }

  function renderTranslationStrategyBoard() {
    const el = $('translationStrategyBoard');
    if (!el || !X) return;
    const investment = X.translationInvestmentModel(state);
    const profile = X.specializationModel(state);
    const repRows = investment.repeatables.map(x => `<div class="depth-option ${x.affordable ? 'affordable' : ''}"><span>${escapeHtml(x.name)} · Lv${x.level}</span><strong>${x.cost.format(0)} TI</strong><small>${escapeHtml(x.impact)}</small></div>`).join('');
    const permanent = investment.permanent ? `<div class="depth-option ${state.ti.gte(investment.permanent.cost) ? 'affordable' : ''}"><span>Next permanent</span><strong>${escapeHtml(investment.permanent.name)} · ${investment.permanent.cost} TI</strong><small>Permanent development unlock</small></div>` : `<div class="depth-option"><span>Permanent path</span><strong>Complete</strong><small>All Translation Development unlocks acquired.</small></div>`;
    const rec = investment.recommendation;
    paint(el, () => `<div class="midgame-depth-copy"><p class="eyebrow">TRANSLATION STRATEGY</p><h2>${escapeHtml(profile.name)} · ${escapeHtml(profile.role)}</h2><p>${escapeHtml(profile.bestFor)}</p><div class="strategy-recommendation"><span>Current investment call</span><strong>${escapeHtml(rec?.title || 'Hold TI for the next meaningful breakpoint')}</strong><small>${escapeHtml(rec?.reason || 'No additional Translation investment is currently available.')}</small></div></div><div class="depth-option-list">${permanent}${repRows}</div>`);
  }

  function renderAutoProfiles() {
    const el = $('autoProfileGrid');
    if (!el || !X) return;
    const profiles = X.autoProfiles(state);
    paint(el, () => profiles.map(p => `<button class="auto-profile-card" data-auto-profile="${p.id}" ${state.automation.translation ? '' : 'disabled'}><strong>${escapeHtml(p.label)}</strong><span>${escapeHtml(p.description)}</span><small>min ${fmtTime(p.settings.minRun)} · ${Number(p.settings.resetMultiple).toFixed(2)}× gain · max ${fmtTime(p.settings.maxRun)}</small></button>`).join(''));
  }

  function renderNetworkDepth() {
    const el = $('networkDepthPanel');
    if (!el || !X) return;
    const visible = state.networks > 0 || state.lifetimeNc.gt(0);
    el.classList.toggle('hidden', !visible);
    if (!visible) return;
    const model = X.networkResetModel(state);
    const recent = model.recentBest ? `${(model.recentBest*3600).toFixed(2)} NC/h` : 'No baseline yet';
    el.dataset.tone = model.action === 'reset' ? 'ready' : model.action === 'consider' ? 'consider' : 'wait';
    paint(el, () => `<div class="midgame-depth-copy"><p class="eyebrow">NETWORK CYCLE PLANNER</p><h2>${escapeHtml(model.posture.label)}</h2><p>${escapeHtml(model.posture.description)} ${escapeHtml(model.reason)}</p></div><div class="midgame-depth-metrics">${depthMetric('Gain now', `${model.gain.toFixed(0)} NC`)}${depthMetric('Current pace', `${(model.currentPerSec*3600).toFixed(2)} NC/h`)}${depthMetric('Recent best', recent)}${depthMetric('Readiness', `${Math.round(model.readiness.score*100)}%`)}</div>`);
  }

  function renderAllocationStrategy() {
    if (!X || state.networks === 0) return;
    const board = $('allocationStrategyBoard');
    const grid = $('allocationTemplateGrid');
    if (!board || !grid) return;
    const current = X.allocationMetrics(state, state.allocation);
    paint(board, () => `<div><p class="eyebrow">CURRENT POSTURE</p><h3>${escapeHtml(current.posture.label)}</h3><p>${escapeHtml(current.posture.description)}</p></div><div class="synergy-ledger">${depthMetric('Local ↔ Regional', `×${current.recoveryBridge.toFixed(2)} recovery`)}${depthMetric('International ↔ Digital', `×${current.insightBridge.toFixed(2)} TI bridge`)}${depthMetric('Regional ↔ Digital', `×${current.projectBridge.toFixed(2)} Project bridge`)}</div>`);
    paint(grid, () => X.allocationTemplateModels(state).map(t => `<button class="allocation-template-card" data-allocation-template="${t.id}" ${t.metrics.valid ? '' : 'disabled'}><span class="eyebrow">${escapeHtml(t.label.toUpperCase())}</span><strong>${escapeHtml(t.metrics.posture.label)}</strong><small>${escapeHtml(t.intent)}</small><div><span>Pages ×${t.metrics.pageMultiplier.toFixed(2)}</span><span>TI ×${t.metrics.international.toFixed(2)}</span><span>Projects ${t.metrics.projectPercent.toFixed(0)}%</span></div></button>`).join(''));
  }

  function render() {
    applyDisclosure(D.getDisclosure(state, G));
    currentUx = U?.getAll(state, G) || {};
    const pps = G.pageProduction(state);
    const gain = G.translationGain(state);
    const readiness = G.translationReadiness(state);
    const currentThreshold = G.translationThreshold(state);

    const precise = value => value.isZero ? '0' : value.log10 < 15 ? value.toNumber().toLocaleString('en-US', {maximumFractionDigits: 3}) : `${Math.pow(10, value.log10 - Math.floor(value.log10)).toPrecision(12)} × 10^${Math.floor(value.log10)}`;
    if ($('resourceShelf').classList.contains('resource-details-open')) {
      const rows = [`Pages: ${precise(state.pages)} · ${precise(pps)} per second`, `Peak Pages: ${precise(state.peakPages)} · Run: ${fmtTime(state.runTime)}`];
      for (const [key, label, amount, lifetime] of [['ti','Translation Insight',state.ti,state.lifetimeTi],['nc','Network Capacity',state.nc,state.lifetimeNc],['fe','Field Experience',state.fe,state.lifetimeFe],['legacy','Legacy',state.legacy,state.lifetimeLegacy]]) {
        if (!document.querySelector(`[data-resource="${key}"]`).classList.contains('hidden')) rows.push(`${label}: ${precise(amount)} · Lifetime: ${precise(lifetime)}`);
      }
      $('resourceReadout').textContent = rows.join('\n');
    }
    $('pagesValue').textContent = readableAmount(state.pages);
    $('ppsValue').textContent = `${readableAmount(pps)} / sec`;
    $('peakValue').textContent = readableAmount(state.peakPages);
    $('runTime').textContent = fmtTime(state.runTime);
    $('heroTiValue').textContent = state.ti.format(0);
    $('heroTiMeta').textContent = `${state.lifetimeTi.format(0)} lifetime · ${state.translations} Translation${state.translations === 1 ? '' : 's'}`;
    $('heroNcValue').textContent = state.nc.format(0);
    $('heroNcMeta').textContent = `${state.lifetimeNc.format(0)} lifetime · ${state.networks} Network${state.networks === 1 ? '' : 's'}`;
    $('heroFeValue').textContent = state.fe.format(0);
    $('heroFeMeta').textContent = `${state.lifetimeFe.format(0)} lifetime · ${Math.min(state.field.index, G.FIELDS.length)} canonical Fields`;
    $('heroLegacyValue').textContent = state.legacy.format(0);
    $('heroLegacyMeta').textContent = `${state.lifetimeLegacy.format(0)} lifetime · ${state.legacies} Legac${state.legacies === 1 ? 'y' : 'ies'}`;

    renderPrimaryProgress(currentDisclosure, pps, gain, readiness, currentThreshold);
    renderEarlyJourney();
    renderLayerStatus();
    renderDecisionCockpits();
    renderTranslationDepth();
    renderAtlas();
    paint($('queueContent'),()=>WS.queue(state,G));
    $('queueAdd').disabled=!G.queueUnlocked(state)||state.purchaseQueue.orders.length>=6;
    const layer=document.body.dataset.activeTab;
    if (['translation','network','legacy'].includes(layer) && $(layer+'ExactPreview')) paint($(layer+'ExactPreview'),()=>W.resetPreview(state,layer)?WS.reset(W.resetPreview(state,layer),{translation:'Translation Insight',network:'Network Capacity',legacy:'Legacy'}[layer],readableAmount):window.WTTNSecondaryScreens.conditionalReset(state,layer));

    const maxUnlocked = G.hasBuyMax(state);
    $('buyMaxButton').disabled = !maxUnlocked;
    $('buyMaxButton').title = maxUnlocked ? 'Buy as many as affordable' : 'Buy every affordable copy';
    if (!maxUnlocked && buyAmount === 'max') buyAmount = '10';
    document.querySelectorAll('[data-buy-amount]').forEach(x => x.classList.toggle('active', x.dataset.buyAmount === buyAmount));

    paint($('producerGrid'), () => W.visibleProducers(state).map(producerHtml).join(''));
    paint($('upgradeGrid'), () => W.visibleMethods(state).map(upgradeHtml).join(''));
    paint($('projectGrid'), () => G.PROJECTS.map(projectHtml).join(''));
    if($('commissionReference'))paint($('commissionReference'),()=>state.pageUpgrades.reference?'<details><summary>Reference shelves · relationships and comparisons</summary>'+window.WTTNSecondaryScreens.reference(state,readableAmount)+'</details>':'<p class="fineprint">Reference System adds optional production relationships and commission comparisons in the Grand Library. All commission requirements and effects are shown above.</p>');

    const anyProject = G.PROJECTS.some(def => G.projectStatus(state, def.id).available && !state.projects[def.id]);
    $('projectBadge').classList.toggle('hidden', !anyProject);
    $('translationBadge').classList.toggle('hidden', gain.lt(1));
    $('insightBadge').classList.toggle('hidden', state.translations === 0 || state.ti.lt(1));
    $('networkBadge').classList.toggle('hidden', G.networkGain(state).lt(1) && !G.fieldUnlocked(state));
    $('fieldBadge').classList.toggle('hidden', !(G.canEnterField(state) || G.fieldReward(state).gte(1)));
    $('legacyBadge').classList.toggle('hidden', !(G.legacyGain(state).gte(1) || G.finalSequenceAvailable(state)));
    const libraryUnlocked = G.SCRIPTURE_COLLECTIONS.filter(c => G.scriptureCollectionUnlocked(state, c.id)).length;
    $('scriptureBadge').classList.toggle('hidden', libraryUnlocked === 0);

    $('tiGain').textContent = gain.format(0);
    $('tiValue').textContent = state.ti.format(0);
    $('lifetimeTiValue').textContent = state.lifetimeTi.format(0);
    $('translationCount').textContent = String(state.translations);
    $('translationRun').textContent = fmtTime(state.runTime);
    $('bestTranslationGain').textContent = state.records.bestTranslationGain.format(0);
    $('fastestTranslation').textContent = fmtTime(state.records.fastestTranslation);
    $('readinessLabel').textContent = readiness.label;
    $('readinessText').textContent = readiness.recommendation;
    $('readinessBox').dataset.status = readiness.status;
    $('translateBtn').disabled = gain.lt(1);
    $('translateBtn').textContent = gain.gte(1) ? `Complete Translation · +${gain.format(0)} TI` : 'Complete Translation';

    const diagnosticsUnlocked = !!state.tiOneTime.standardTerminology;
    $('efficiencyBox').classList.toggle('hidden', !diagnosticsUnlocked);
    if (diagnosticsUnlocked) {
      paint($('efficiencyBox'), () => `<div><span>Gain rate</span><strong>${G.translationEfficiency(state).toFixed(2)} TI/min</strong></div><div><span>Readiness</span><strong>${Math.round(readiness.score * 100)}%</strong></div><div><span>Formula</span><strong>(Peak / ${currentThreshold.format(1)})<sup>0.65</sup></strong></div>`);
    }

    const recentUnlocked = !!state.tiOneTime.reusableTemplates;
    $('recentRunsSection').classList.toggle('hidden', !recentUnlocked);
    if (recentUnlocked) paint($('recentRuns'), () => state.records.recentTranslations.length ? state.records.recentTranslations.map(recentRunHtml).join('') : '<p class="muted">No completed Translation runs yet.</p>');

    const insightOpen = state.translations > 0 || state.lifetimeTi.gt(0);
    $('insightLocked').classList.toggle('hidden', insightOpen);
    $('insightContent').classList.toggle('hidden', !insightOpen);
    if (insightOpen) {
      $('insightTi').textContent = `${state.ti.format(0)} TI`;
      $('insightLifetime').textContent = `${state.lifetimeTi.format(0)} TI`;
      $('workflowSummary').textContent = `×${G.workflowMultiplier(state).toFixed(2)}`;
      $('trainingSummary').textContent = `×${G.trainingFactor(state).toFixed(2)} synergy`;
      paint($('repeatableGrid'), () => G.TI_REPEATABLES.map(repeatableHtml).join(''));
      paint($('oneTimeGrid'), () => G.TI_ONE_TIMES.map(oneTimeHtml).join(''));
      paint($('specializationGrid'), () => G.SPECIALIZATIONS.map(specializationHtml).join(''));
      $('specializationHint').textContent = G.specializationUnlocked(state)
        ? state.specialization ? `Current: ${state.specialization}. Changes are queued for the next Translation.` : 'Choose your first working approach.'
        : 'Purchase Organized Desk to choose a working approach';
      renderTranslationStrategyBoard();
      renderAutomationControls();
      renderAutoProfiles();
      $('presetSection').classList.toggle('hidden', !state.tiOneTime.presets);
      if (state.tiOneTime.presets) paint($('presetGrid'), () => state.presets.map(presetHtml).join(''));
    }

    const nGain = G.networkGain(state);
    const nReady = G.networkReadiness(state);
    const nEffects = G.allocationEffects(state);
    $('networkNc').textContent = `${state.nc.format(0)} NC`;
    $('networkLifetimeNc').textContent = `${state.lifetimeNc.format(0)} NC`;
    $('networkTiEarned').textContent = `${state.tiThisNetwork.format(0)} TI`;
    $('networkRunTime').textContent = fmtTime(state.networkRunTime);
    $('ncGain').textContent = nGain.format(0);
    $('networkReadinessLabel').textContent = nReady.label;
    $('networkReadinessText').textContent = nReady.recommendation;
    $('networkReadinessBox').dataset.status = nReady.status;
    $('networkResetBtn').disabled = nGain.lt(1);
    $('networkResetBtn').textContent = nGain.gte(1) ? `Establish Network · +${nGain.format(0)} NC` : 'Establish Network';
    paint($('networkEfficiencyBox'), () => `<div><span>Gain rate</span><strong>${G.networkEfficiency(state).toFixed(2)} NC/h</strong></div><div><span>Readiness</span><strong>${Math.round(nReady.score*100)}%</strong></div><div><span>Formula</span><strong>(TI / ${G.effectiveNetworkThreshold(state).format(0)})<sup>0.30</sup></strong></div>`);
    renderNetworkDepth();
    $('networkCount').textContent = String(state.networks);
    $('bestNetworkGain').textContent = `${state.records.bestNetworkGain.format(0)} NC`;
    $('fastestNetwork').textContent = fmtTime(state.records.fastestNetwork);
    $('fieldNcProgress').textContent = `${state.lifetimeNc.format(0)} / ${G.FIELD_UNLOCK_LIFETIME_NC.format(0)} NC`;
    $('distributionSection').classList.toggle('hidden', state.networks === 0);
    if (state.networks > 0) {
      const lim = G.allocationLimits(state);
      $('allocationNote').textContent = `Move capacity in 5% steps. Caps: any ${Math.round(lim.cap*100)}%, Local ${Math.round(lim.localCap*100)}%, International ${Math.round(lim.internationalCap*100)}%; Digital minimum ${Math.round(lim.digitalMin*100)}%.`;
      paint($('allocationGrid'), () => G.DISTRIBUTION_CHANNELS.map(allocationHtml).join(''));
      paint($('allocationEffects'), () => `<div><span>Local recovery</span><strong>×${nEffects.local.toFixed(2)}</strong></div><div><span>Regional Pages</span><strong>×${nEffects.regional.toFixed(2)}</strong></div><div><span>International TI</span><strong>×${nEffects.international.toFixed(2)}</strong></div><div><span>Project thresholds</span><strong>${(nEffects.digitalProjectDivisor*100).toFixed(0)}%</strong></div>`);
      renderAllocationStrategy();
    }
    paint($('networkUpgradeGrid'), () => G.NETWORK_UPGRADES.map(networkUpgradeHtml).join(''));
    $('networkPresetSection').classList.toggle('hidden', !state.netOneTime.distributionNotes);
    if (state.netOneTime.distributionNotes) paint($('networkPresetGrid'), () => state.networkPresets.map(networkPresetHtml).join(''));
    $('recentNetworksSection').classList.toggle('hidden', state.records.recentNetworks.length === 0);
    if (state.records.recentNetworks.length) paint($('recentNetworks'), () => state.records.recentNetworks.map(recentNetworkHtml).join(''));
    const fieldPct = Math.min(100, state.lifetimeNc.toNumber() / G.FIELD_UNLOCK_LIFETIME_NC.toNumber() * 100);
    $('fieldProgressBar').style.width = `${fieldPct}%`;
    $('fieldPreviewTitle').textContent = G.currentField(state)?.name || (state.phase3Complete ? (G.nextField(state)?.name || 'Mission Fields complete') : 'Mission Fields');
    $('fieldPreviewText').textContent = G.currentField(state)
      ? `${G.currentField(state).description} Progress: ${state.field.progressNc.format(0)} / ${G.fieldThreshold(state).format(0)} valid NC.`
      : state.phase3Complete
        ? `${G.nextField(state)?.name || 'Mature Field'} is ${G.canEnterField(state) ? 'ready to enter' : 'waiting for at least 1 NC of fresh Field-cycle progress'}.`
        : `Establish ${G.FIELD_UNLOCK_LIFETIME_NC.format(0)} lifetime NC to unlock the first Mission Field. Current progress: ${state.lifetimeNc.format(0)}.`;
    $('openFieldsBtn').disabled = !(state.phase3Complete || G.fieldUnlocked(state) || state.field.index > 0);

    const stats = [
      ['Current production', `${pps.format(2)} P/s`],
      ['Highest production', `${state.records.highestPps.format(2)} P/s`],
      ['Time played', fmtTime(state.timePlayed)],
      ['Current run', fmtTime(state.runTime)],
      ['Translations', String(state.translations)]
    ];
    if (currentDisclosure.tabs.insight) stats.push(
      ['Lifetime TI', state.lifetimeTi.format(0)],
      ['Best Translation', `${state.records.bestTranslationGain.format(0)} TI`],
      ['Fastest Translation', fmtTime(state.records.fastestTranslation)],
      ['Workflow', `Lv ${state.tiUpgrades.workflow}`],
      ['Training', `Lv ${state.tiUpgrades.training}`],
      ['Preparation', `Lv ${state.tiUpgrades.preparation}`],
      ['Specialization', state.specialization || '—']
    );
    if (currentDisclosure.tabs.network) stats.push(
      ['Network Capacity', state.nc.format(0)],
      ['Lifetime NC', state.lifetimeNc.format(0)],
      ['Networks', String(state.networks)],
      ['TI this Network', state.tiThisNetwork.format(0)],
      ['Network cycle', fmtTime(state.networkRunTime)],
      ['Infrastructure', `Lv ${state.netUpgrades.infrastructure}`]
    );
    if (currentDisclosure.tabs.fields) stats.push(
      ['Field Experience', state.fe.format(0)],
      ['Lifetime FE', state.lifetimeFe.format(0)],
      ['Fields cleared', `${state.field.index} / ${G.FIELDS.length}`],
      ['Current Field', G.currentField(state)?.name || '—']
    );
    if (currentDisclosure.tabs.legacy) stats.push(
      ['FE this Legacy', `${state.feThisLegacy.format(0)} / ${G.LEGACY_UNLOCK_FE.format(0)}`],
      ['Legacy', state.legacy.format(0)],
      ['Lifetime Legacy', state.lifetimeLegacy.format(0)],
      ['Legacies', String(state.legacies)],
      ['Tradition', state.tradition ? (G.traditionDef(state.tradition)?.name || state.tradition) : '—'],
      ['Mature Fields', String(state.field.matureClears || 0)],
      ['Campaign', state.campaign.complete ? 'Complete' : G.finalSequenceAvailable(state) ? 'Final sequence ready' : 'In progress']
    );
    paint($('statsGrid'), () => stats.map(([k,v]) => `<article class="stat-card"><span>${k}</span><strong>${v}</strong></article>`).join(''));
    const etas = G.estimateProgressEtas(state);
    const etaStats = [['Translation threshold', fmtEta(etas.translation)]];
    if (currentDisclosure.tabs.network) etaStats.push(['Network threshold', fmtEta(etas.network)]);
    if (currentDisclosure.tabs.fields) etaStats.push(['Field NC threshold', fmtEta(etas.field)]);
    if (currentDisclosure.tabs.legacy) etaStats.push(['Legacy FE threshold', fmtEta(etas.legacy)]);
    paint($('etaGrid'), () => etaStats.map(([k,v]) => `<article class="stat-card"><span>${k}</span><strong>${v}</strong></article>`).join(''));
    const offlineStats = [
      ['Offline simulated', fmtTime(state.records.offlineSeconds || 0)],
      ['Offline sessions', String(state.records.offlineSessions || 0)],
      ['Largest gap', fmtTime(state.records.largestOfflineGap || 0)],
      ['Offline cap', fmtTime(state.system?.offlineCapSeconds || 14 * 86400)]
    ];
    paint($('offlineStatsGrid'), () => offlineStats.map(([k,v]) => `<article class="stat-card"><span>${k}</span><strong>${v}</strong></article>`).join(''));
    const activeScreen = document.querySelector('.tab.active')?.dataset.tab || 'work';
    if (activeScreen === 'fields') renderFields();
    if (activeScreen === 'legacy') renderLegacy();
    if (activeScreen === 'scripture') renderScripture();
    if (activeScreen === 'system') renderSystem();
    const unsavedAge = Date.now() - Number(state.lastSavedAt || 0);
    if (storageAvailable && !saveQuarantined && unsavedAge > 11000) updateSaveStatus('Unsaved', 'dirty');
    if (activeScreen === 'stats') $('debugOutput').textContent = JSON.stringify(G.getDebugSnapshot(state), null, 2);

    wireDynamicActions();
    window.WTTNSettlement?.update(state);
    M?.reconcile?.(state, G);
    Q?.reconcile?.(state, G);

    if (state.phase2Complete && !masteryShown && state.networks === 0) {
      masteryShown = true;
      openModal('masteryModal', 'masteryContinueBtn');
    }
    if (state.phase3Complete && !phase3Shown) {
      phase3Shown = true;
      openModal('phase3Modal', 'phase3ContinueBtn');
    }
    if (state.phase4Complete && !phase4Shown) {
      phase4Shown = true;
      openModal('phase4Modal', 'phase4ContinueBtn');
    }
    if (state.phase5Complete && !phase5Shown) {
      phase5Shown = true;
      openModal('phase5Modal', 'phase5ContinueBtn');
    }
  }

  function wireDynamicActions() {
    document.querySelectorAll('[data-quick-producer]').forEach(button => button.onclick = () => {
      const id = button.dataset.quickProducer;
      const result = G.buyProducer(state, id, 1);
      if (result.bought) { render(); toast(`${G.PRODUCERS.find(p => p.id === id).name} added`); Q?.play?.('purchase'); M?.cardFeedback?.(`producer-${id}`, {label:'+1',tone:'work'}); }
    });
    document.querySelectorAll('[data-producer]').forEach(btn => btn.onclick = () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      const id = btn.dataset.producer;
      const quantity = buyAmount === 'max' && G.hasBuyMax(state) ? 'max' : Number(buyAmount === 'max' ? 10 : buyAmount);
      const result = G.buyProducer(state, id, quantity);
      if (result.bought) {
        toast(`${result.bought} ${G.PRODUCERS.find(p => p.id === id)?.name || 'producer'} added`);
        render();
        M?.cardFeedback?.(`producer-${id}`, { label: `+${result.bought}`, tone: 'work' }); Q?.play?.('purchase', { intensity: result.bought > 1 ? 1.08 : 1 });
      }
    });
    document.querySelectorAll('[data-upgrade]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.upgrade;
      if (G.buyPageUpgrade(state, id)) { render(); M?.cardFeedback?.(`upgrade-${id}`, { label: 'Method active', tone: 'work' }); Q?.play?.('method'); }
    });
    document.querySelectorAll('[data-project]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.project;
      if (G.completeProject(state, id)) {
        toast('Project completed'); render(); Q?.play?.('project');
      }
    });
    document.querySelectorAll('[data-ti-repeatable]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.tiRepeatable;
      if (G.buyTiRepeatable(state, id)) { toast('Translation practice improved'); render(); M?.cardFeedback?.(`ti-repeatable-${id}`, { label: 'Practice improved', tone: 'translation' }); Q?.play?.('practice'); }
    });
    document.querySelectorAll('[data-ti-onetime]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.tiOnetime;
      if (G.buyTiOneTime(state, id)) { toast('Permanent Translation unlock acquired'); render(); M?.cardFeedback?.(`ti-onetime-${id}`, { label: 'Permanent unlock', tone: 'translation', milestone: true }); Q?.play?.('unlock'); }
    });
    document.querySelectorAll('[data-specialization]').forEach(btn => btn.onclick = () => {
      const wasEmpty = !state.specialization;
      if (G.setSpecialization(state, btn.dataset.specialization, { forNextRun: !wasEmpty })) {
        toast(wasEmpty ? 'Specialization selected' : 'Specialization queued for next Translation'); render();
        M?.cardFeedback?.(document.querySelector(`[data-specialization="${btn.dataset.specialization}"]`)?.closest('.specialization-card'), { label: wasEmpty ? 'Build selected' : 'Queued', tone: 'translation', milestone: wasEmpty }); Q?.play?.(wasEmpty ? 'unlock' : 'select');
      }
    });
    document.querySelectorAll('[data-auto-profile]').forEach(btn => btn.onclick = () => { if (!X || !state.automation.translation) return; const id = btn.dataset.autoProfile; const label = ({active:'Active', balanced:'Balanced', idle:'Idle'})[id] || 'Translation'; G.setAutoSettings(state, X.autoProfileSettings(state, id)); toast(`${label} Translation profile applied`); render(); Q?.play?.('select'); });
    document.querySelectorAll('[data-preset-save]').forEach(btn => btn.onclick = () => { if (G.savePreset(state, btn.dataset.presetSave)) { toast('Preset saved'); render(); } });
    document.querySelectorAll('[data-preset-load]').forEach(btn => btn.onclick = () => { if (G.loadPreset(state, btn.dataset.presetLoad)) { toast('Preset loaded'); render(); } });
    document.querySelectorAll('[data-network-upgrade]').forEach(btn => btn.onclick = () => { const id = btn.dataset.networkUpgrade; if (G.buyNetworkUpgrade(state, id)) { toast('Network development acquired'); render(); M?.cardFeedback?.(`network-upgrade-${id}`, { label: 'Network improved', tone: 'network' }); Q?.play?.('unlock'); } });
    document.querySelectorAll('[data-allocation-minus]').forEach(btn => btn.onclick = () => { const channel = btn.dataset.allocationMinus; if (adjustAllocation(channel, -0.05)) { render(); M?.allocationChanged?.(channel); Q?.play?.('allocation'); } });
    document.querySelectorAll('[data-allocation-plus]').forEach(btn => btn.onclick = () => { const channel = btn.dataset.allocationPlus; if (adjustAllocation(channel, 0.05)) { render(); M?.allocationChanged?.(channel); Q?.play?.('allocation'); } });
    document.querySelectorAll('[data-allocation-template]').forEach(btn => btn.onclick = () => { if (applyAllocationTemplate(btn.dataset.allocationTemplate)) { toast('Distribution allocation applied'); render(); M?.atlasEvent?.('network'); Q?.play?.('allocation', { intensity:1.08 }); } });
    document.querySelectorAll('[data-network-preset-save]').forEach(btn => btn.onclick = () => { if (G.saveNetworkPreset(state, btn.dataset.networkPresetSave)) { toast('Distribution preset saved'); render(); } });
    document.querySelectorAll('[data-network-preset-load]').forEach(btn => btn.onclick = () => { if (G.loadNetworkPreset(state, btn.dataset.networkPresetLoad)) { toast('Distribution preset loaded'); render(); } });
    document.querySelectorAll('[data-tradition]').forEach(btn => btn.onclick = () => {
      const first = !state.tradition;
      if (G.setTradition(state, btn.dataset.tradition)) { const id = btn.dataset.tradition; toast(first ? 'Tradition selected' : 'Tradition queued for the next Legacy'); render(); M?.cardFeedback?.(document.querySelector(`[data-tradition="${id}"]`)?.closest('.tradition-card'), { label: first ? 'Tradition selected' : 'Queued', tone: 'legacy', milestone: first }); Q?.play?.(first ? 'unlock' : 'select'); }
    });
  }

  function setMobileActionsOpen(open) {
    const button = $('mobileMenuButton');
    const actions = $('topActions');
    if (!button || !actions) return;
    const shouldOpen = !!open;
    actions.dataset.mobileOpen = String(shouldOpen);
    button.setAttribute('aria-expanded', String(shouldOpen));
    button.setAttribute('aria-label', shouldOpen ? 'Close application actions' : 'Open application actions');
  }

  function setAtlasScale(next, { announce = true } = {}) {
    atlasScale = Math.max(.75, Math.min(3, Math.round(next * 20) / 20));
    const svg = $('atlasSvg');
    if (svg) {
      svg.style.setProperty('--atlas-scale', String(atlasScale));
      svg.style.width = `${Math.round(atlasScale * 100)}%`;
      svg.style.maxWidth = 'none';
    }
    if ($('atlasViewStatus')) $('atlasViewStatus').textContent = `${Math.round(atlasScale * 100)}%`;
    if (announce) toast(`Atlas view ${Math.round(atlasScale * 100)}%`);
  }

  function navigateAtlasField(fieldId) {
    closeAtlasDialog({ navigating: true });
    switchTab('fields');
    queueMicrotask(() => {
      const card = document.querySelector(`.field-card[data-field-id="${CSS.escape(fieldId)}"]`);
      safeScrollIntoView(card, { block: 'center' });
      const focusTarget = card?.querySelector('button:not([disabled]), summary') || card;
      if (card && focusTarget === card && !card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1');
      focusTarget?.focus?.();
    });
  }

  function openAtlasField(fieldId) {
    const model = A.getAtlasModel(state, G);
    const field = model.fields.find(f => f.id === fieldId);
    if (!field) return;
    const dossier = $('atlasDossier');
    dossier.classList.remove('hidden');
    const def = G.FIELDS.find(f => f.id === fieldId);
    paint($('atlasDossierText'), () => `<p class="eyebrow">SELECTED FIELD · ${escapeHtml(field.status)}</p><h3>${escapeHtml(field.label)}</h3><p>${escapeHtml(def?.description || 'Review this field’s requirements, constraints and available choices in its briefing.')}</p>`);
    $('atlasDossierGo').onclick = () => navigateAtlasField(fieldId);
    $('atlasDossierClose').onclick = () => { dossier.classList.add('hidden'); $('atlasFieldPicker')?.focus(); };
    $('atlasDossierGo').focus({ preventScroll: false });
  }

  function wireAtlasInteraction() {
    const svg = $('atlasSvg');
    const viewport = $('atlasViewport');
    if (!svg || !viewport) return;
    svg.addEventListener('click', e => {
      const node = e.target.closest?.('[data-atlas-field]');
      if (node) openAtlasField(node.dataset.atlasField);
    });
    svg.addEventListener('keydown', e => {
      const node = e.target.closest?.('[data-atlas-field]');
      if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAtlasField(node.dataset.atlasField); }
    });
    $('atlasZoomOutBtn')?.addEventListener('click', () => setAtlasScale(atlasScale - .15));
    $('atlasZoomInBtn')?.addEventListener('click', () => setAtlasScale(atlasScale + .15));
    $('atlasResetViewBtn')?.addEventListener('click', () => {
      setAtlasScale(1);
      viewport.scrollTo({ left: 0, top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
    viewport.classList.add('is-draggable');
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest?.('button,[data-atlas-field]')) return;
      atlasPointerDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.setPointerCapture?.(e.pointerId);
      viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', e => {
      if (!atlasPointerDrag || atlasPointerDrag.id !== e.pointerId) return;
      viewport.scrollLeft = atlasPointerDrag.left - (e.clientX - atlasPointerDrag.x);
      viewport.scrollTop = atlasPointerDrag.top - (e.clientY - atlasPointerDrag.y);
    });
    const end = e => {
      if (!atlasPointerDrag || (e.pointerId != null && atlasPointerDrag.id !== e.pointerId)) return;
      atlasPointerDrag = null; viewport.classList.remove('is-dragging');
    };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);
  }

  function syncViewportMetrics() {
    const vv = window.visualViewport;
    document.documentElement.style.setProperty('--visual-viewport-height', `${Math.round(vv?.height || window.innerHeight)}px`);
    if (!isNarrowViewport()) setMobileActionsOpen(false);
  }

  function installPlatformListeners() {
    $('mobileMenuButton')?.addEventListener('click', () => setMobileActionsOpen($('mobileMenuButton').getAttribute('aria-expanded') !== 'true'));
    $('topActions')?.addEventListener('click', e => { if (e.target.closest('button') && isNarrowViewport()) setMobileActionsOpen(false); });
    document.addEventListener('pointerdown', e => {
      if ($('mobileMenuButton')?.getAttribute('aria-expanded') !== 'true') return;
      if (!e.target.closest?.('#topActions,#mobileMenuButton')) setMobileActionsOpen(false);
    });
    window.addEventListener('resize', syncViewportMetrics, { passive: true });
    window.visualViewport?.addEventListener('resize', syncViewportMetrics, { passive: true });
    document.addEventListener('focusin', e => {
      if (isNarrowViewport() && e.target.matches?.('input,select,textarea')) setTimeout(() => safeScrollIntoView(e.target, { block: 'center' }), 80);
    });
    syncViewportMetrics();
  }

  const tabs = [...document.querySelectorAll('.tab')];
  const panes = [...document.querySelectorAll('.tab-pane')];
  tabs.forEach((btn, index) => {
    btn.setAttribute('role', 'tab');
    btn.id = btn.id || `game-tab-${btn.dataset.tab}`;
    btn.setAttribute('aria-controls', `tab-${btn.dataset.tab}`);
    btn.setAttribute('aria-selected', String(btn.classList.contains('active')));
    btn.setAttribute('tabindex', btn.classList.contains('active') ? '0' : '-1');
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    btn.addEventListener('keydown', e => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
      e.preventDefault();
      const visible = tabs.filter(tab => D.isTabVisible(currentDisclosure, tab.dataset.tab) && tab.getClientRects().length);
      if (!visible.length) return;
      const current = Math.max(0, visible.indexOf(btn));
      let next = current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + visible.length) % visible.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % visible.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = visible.length - 1;
      switchTab(visible[next].dataset.tab); visible[next].focus();
    });
  });
  panes.forEach(pane => {
    pane.setAttribute('role','tabpanel');
    const tab = tabs.find(t => `tab-${t.dataset.tab}` === pane.id);
    if (tab) pane.setAttribute('aria-labelledby', tab.id);
    pane.hidden = !pane.classList.contains('active');
  });

  document.querySelectorAll('[data-buy-amount]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.buyAmount === 'max' && !G.hasBuyMax(state)) { toast('Buy Max is available from the beginning'); return; }
    buyAmount = btn.dataset.buyAmount;
    render();
  }));

  $('saveBtn').onclick = () => { save(true); Q?.play?.('save'); };
  function ask(message, title = 'Replace current progress?') {
    const dialog = $('confirmDialog');
    if (dialog.open) return Promise.resolve(false);
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    return new Promise(resolve => {
      let answered = false;
      const done = value => { if (answered) return; answered = true; dialog.close(); resolve(value); };
      $('cancelConfirmBtn').onclick = () => done(false);
      $('acceptConfirmBtn').onclick = () => done(true);
      dialog.oncancel = e => { e.preventDefault(); done(false); };
      dialog.showModal(); $('cancelConfirmBtn').focus();
    });
  }
  let atlasOrigin = null;
  let atlasNavigating = false;
  const atlasHome = document.createComment('Atlas original location');
  $('missionAtlas').before(atlasHome);
  function openAtlasDialog() {
    atlasOrigin = document.activeElement; atlasNavigating = false;
    $('atlasDialogBody').appendChild($('missionAtlas'));
    $('atlasDialog').showModal();
    renderAtlas();
    setAtlasScale(atlasScale, { announce:false });
  }
  function closeAtlasDialog({ navigating = false } = {}) { atlasNavigating = navigating; if ($('atlasDialog').open) $('atlasDialog').close(); }
  $('atlasDialog').addEventListener('close', () => { atlasHome.after($('missionAtlas'));  if (!atlasNavigating && atlasOrigin?.getClientRects().length) atlasOrigin.focus(); });
  $('openAtlasSelectedFieldBtn').onclick = () => openAtlasField($('atlasFieldPicker').value);
  $('resourceDetailsBtn').onclick = () => {
    const expanded = $('resourceDetailsBtn').getAttribute('aria-expanded') !== 'true';
    $('resourceDetailsBtn').setAttribute('aria-expanded', String(expanded));
    $('resourceShelf').classList.toggle('resource-details-open', expanded);
    render();
  };
  document.querySelectorAll('.utility-dialog:not(#atlasDialog)').forEach(dialog => dialog.addEventListener('close', () => {
    if (document.querySelector('dialog[open]')) return;
    if (isNarrowViewport() && (document.activeElement === document.body || !document.activeElement?.getClientRects().length)) $('mobileMenuButton').focus();
  }));
  $('atlasOverviewBtn').onclick = openAtlasDialog;
  $('dockAtlas').onclick = openAtlasDialog;
  const codex=WS.initCodex({getState:()=>state,onChange:()=>save(false),paint});
  function queueOptions(){const method=$('queueKind').value==='method';$('queueItem').innerHTML=(method?G.PAGE_UPGRADES:G.PRODUCERS).map(d=>`<option value="${d.id}">${d.name}</option>`).join('');$('queueTargetLabel').hidden=method;$('queueTarget').required=!method;}
  queueOptions();$('queueKind').onchange=queueOptions;
  $('queueForm').onsubmit=e=>{e.preventDefault();const ok=G.enqueuePurchase(state,{type:$('queueKind').value,id:$('queueItem').value,target:Number($('queueTarget').value)});$('queueFeedback').textContent=ok?'Order added.':'Choose a valid target; the queue holds six orders after Organized Desk.';if(ok)save(false);render();};
  $('queueContent').onclick=e=>{const b=e.target.closest('[data-queue-action]');if(!b)return;G.editPurchaseQueue(state,Number(b.dataset.index),b.dataset.queueAction);save(false);render();};
  document.addEventListener('click',e=>{const ref=e.target.closest('[data-read-ref]');if(ref){switchTab('scripture');codex.open(ref.dataset.readRef);}});
  document.querySelectorAll('.scripture-refs cite').forEach(c=>{const b=document.createElement('button');b.className='reference-link';b.dataset.readRef=c.textContent;b.textContent=c.textContent;c.replaceWith(b);});

  $('expandAtlasBtn').onclick = openAtlasDialog;
  $('atlasActionBtn').addEventListener('click', () => closeAtlasDialog({ navigating: true }), true);
  $('helpMenuBtn').onclick = () => { setMobileActionsOpen(false); $('helpDialog').showModal(); };
  $('helpBtn').onclick = () => $('helpDialog').showModal();
  $('exportMigrationBtn').onclick = () => { const raw=storageGet(MIGRATION_KEY); if(!raw){toast('No older save has needed migration in this browser.');return;} $('exportText').value=raw; $('exportFeedback').textContent='Original pre-upgrade save. Keep this file with your previous game version.'; $('exportDialog').showModal(); };
  $('exportBtn').onclick = () => {
    $('exportText').value = makeEnvelope(state);
    $('exportFeedback').textContent = '';
    $('exportDialog').showModal();
  };
  $('retrySaveBtn').onclick = () => save(true);
  $('exportWarningBtn').onclick = () => $('exportBtn').click();
  $('fullBackupBtn').onclick=()=>{ $('exportText').value=window.WTTNFullBackup.make(makeEnvelope(state),window.WTTNVisualPreferences.get().placements);$('exportFeedback').textContent='Full backup: validated progress and decoration locations. Device preferences stay local.';};
  $('progressOnlyBtn').onclick=()=>{$('exportText').value=makeEnvelope(state);$('exportFeedback').textContent='Compatible progress-only save. Local arrangements are not included.';};
  $('exportFullRecoveryBtn').onclick=()=>{const raw=storageGet(window.WTTNFullBackup.RECOVERY_KEY);if(!raw){toast('No full backup has been imported yet.');return;}$('exportText').value=raw;$('exportFeedback').textContent='Progress and arrangement from before the last full import.';$('exportDialog').showModal();};
  $('downloadSaveBtn').onclick = () => {
    const blob = new Blob([$('exportText').value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `word-to-the-nations-save-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('exportFeedback').textContent = 'Download requested. If your browser blocks it, use Copy save text.';
  };
  $('copySaveBtn').onclick = async () => {
    try { await navigator.clipboard.writeText($('exportText').value); $('exportFeedback').textContent = 'Save copied.'; }
    catch { $('exportText').focus(); $('exportText').select(); $('exportFeedback').textContent = 'Text selected. Use your device’s Copy command to keep it.'; }
  };
  $('importBtn').onclick = () => { $('importFeedback').textContent = ''; $('importDialog').showModal(); };
  $('chooseSaveFileBtn').onclick = () => $('importFile').click();
  async function importSaveText(text) {
    const feedback = $('importFeedback');
    try {
      if (storageGet(window.WTTNFullBackup.JOURNAL_KEY)) throw new Error('Reopen the game to finish interrupted import recovery before importing another save.');
      if (new Blob([text]).size > MAX_IMPORT_BYTES) throw new Error('Save is larger than the 2 MB limit.');
      const parsed = window.WTTNFullBackup.parse(text);
      if (!preserveMigration(parsed.economic)) throw new Error('Could not preserve the pre-migration save. Export a backup and free local storage before importing.');
      if (!await ask('Import this validated save? The current campaign will be kept as a recovery snapshot.')) return false;
      const recovery = makeEnvelope(state);
      // Write the pre-import state explicitly: do not rely on a possibly stale autosave.
      let backupWritten;
      if(parsed.full){window.WTTNFullBackup.commit(localStorage,parsed,recovery,window.WTTNVisualPreferences.get(),{save:SAVE_KEY,backup:BACKUP_KEY,preferences:window.WTTNVisualPreferences.KEY});backupWritten=true;}else backupWritten=storageSet(BACKUP_KEY,recovery);
      if (!backupWritten && !await ask('Local storage is unavailable. There will be no recovery snapshot. Export your current progress first, or continue without a backup.', 'No recovery copy is available')) return false;
      state = parsed.state; saveQuarantined = false;
      if(parsed.full)window.WTTNVisualPreferences.adoptPlacements(parsed.placements);
      M?.seed?.(state, G); Q?.seed?.(state, G); window.WTTNSettlement?.seed();
      currentDisclosure = D.getDisclosure(state, G);
      currentUx = U?.getAll(state, G) || currentUx;
      save(false, { backup: false });
      masteryShown = !!state.phase2Complete; phase3Shown = !!state.phase3Complete; phase4Shown = !!state.phase4Complete; phase5Shown = !!state.phase5Complete;
      $('importDialog').close(); $('importText').value = ''; lastAtlasSignature = '';
      render(); toast(parsed.full?'Full backup imported · progress and arrangement':'Save imported and validated'); return true;
    } catch (err) {
      if (storageGet(window.WTTNFullBackup.JOURNAL_KEY)) {
        saveQuarantined = true;
        updateSaveStatus('Recovery needed', 'error');
        setStorageWarning('An interrupted full import still needs recovery. Autosaving is paused. Export your current progress, then reopen the game after browser storage is available.');
      }
      feedback.textContent = `Import not applied. ${err.message || 'This is not a valid save.'}`; return false;
    }
  }
  $('importFile').onchange = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) $('importFeedback').textContent = 'Import not applied. File exceeds the 2 MB limit.';
    else { try { await importSaveText(await file.text()); } catch { $('importFeedback').textContent = 'The file could not be read. Current progress is unchanged.'; } }
    event.target.value = '';
  };
  $('importTextBtn').onclick = async () => { $('importTextBtn').disabled = true; try { await importSaveText($('importText').value); } finally { $('importTextBtn').disabled = false; } };
  $('resetBtn').onclick = async () => {
    if (storageGet(window.WTTNFullBackup.JOURNAL_KEY)) { toast('Finish interrupted import recovery before resetting. Export your progress, then reopen the game.'); return; }
    if (!await ask('Reset the entire campaign? Export a copy first. This clears all campaign progress in this browser.', 'Reset this campaign?')) return;
    saveQuarantined = false; state = G.createState(); M?.seed?.(state, G); Q?.seed?.(state, G); window.WTTNSettlement?.seed(); currentDisclosure = D.getDisclosure(state, G);
    masteryShown = false; phase3Shown = false; phase4Shown = false; phase5Shown = false; lastAtlasSignature = '';
    storageRemove(BACKUP_KEY); save(false, { backup: false }); switchTab('work'); render(); toast('Campaign reset');
  };

  $('translateBtn').onclick = async () => {
    const gain = G.translationGain(state); if (gain.lt(1)) return;
    const readiness = G.translationReadiness(state);
    if (readiness.status === 'early' && state.system?.confirmEarlyResets !== false && !await ask(`This run is still compressed and currently worth ${gain.format(0)} TI. Translate anyway?`, 'Complete Translation?')) return;
    const first = state.translations === 0;
    const result = G.completeTranslation(state, false); if (!result.ok) return;
    save(); render();
    M?.transition?.('translation', {
      eyebrow: first ? 'FIRST TRANSLATION' : 'TRANSLATION COMPLETE',
      title: `+${result.gain.format(0)} Translation Insight`,
      detail: first ? 'Learning can now persist across Translation cycles.' : 'Carry what was learned into the next run.',
      duration: first ? 1050 : 820,
      onDone: first ? () => { $('completionGain').textContent = `${result.gain.format(0)} TI`; openModal('completionModal', 'continueBtn'); } : null
    });
    Q?.play?.('translation', { intensity:first ? 1.18 : 1 });
    if (!first) toast(`Translation complete · +${result.gain.format(0)} TI`);
  };

  $('networkResetBtn').onclick = async () => {
    const gain = G.networkGain(state); if (gain.lt(1)) return;
    const readiness = G.networkReadiness(state);
    if (readiness.status === 'early' && state.system?.confirmEarlyResets !== false && !await ask(`This Network cycle is compressed and currently worth ${gain.format(0)} NC. Establish it anyway?`, 'Review this departure')) return;
    if (!await ask(`Establish this Network for +${gain.format(0)} NC? This resets current TI and Translation development. Base producer automation remains solved.`, 'Establish Network?')) return;
    const result = G.completeNetwork(state); if (!result.ok) return;
    save(); render();
    M?.numberPulse?.('heroNcValue', 'network');
    M?.atlasEvent?.('network');
    M?.transition?.('network', { eyebrow:'NETWORK ESTABLISHED', title:`+${result.gain.format(0)} Network Capacity`, detail:'Distribution routes reorganize around the new Network.', duration:900 });
    Q?.play?.('network');
    toast(`Network established · +${result.gain.format(0)} NC`);
  };

  async function enterFieldRoute(fieldId = null) {
    const field = fieldId ? (G.FIELDS.find(f => f.id === fieldId) || (fieldId === G.MATURE_FIELD.id ? G.MATURE_FIELD : null)) : G.nextField(state);
    if (!field || !G.canEnterField(state, field.id)) return false;
    const strategy = F?.strategyFor?.(field);
    const briefing = strategy ? `\n\nPrimary pressure: ${strategy.pressure}.\n${strategy.approach}` : '';
    if (!await ask(`Enter ${field.name}? This resets current TI, NC, Translation development, and Network development. Permanent Field rewards and solved base automation remain.${briefing}`, 'Enter this Field?')) return false;
    const result = G.enterField(state, field.id); if (!result.ok) return false;
    save(); render();
    M?.atlasEvent?.('field-enter');
    M?.transition?.('field-enter', { eyebrow:`TIER ${field.tier} MISSION FIELD`, title:field.name, detail:'The familiar systems now operate under a different set of constraints.', duration:980 });
    Q?.play?.('fieldEnter');
    toast(`${field.name} entered`);
    return true;
  }

  $('enterFieldBtn').onclick = () => enterFieldRoute();
  $('fieldGrid').addEventListener('click', e => {
    const button = e.target.closest?.('[data-enter-field]');
    if (!button) return;
    enterFieldRoute(button.dataset.enterField);
  });

  $('completeFieldBtn').onclick = async () => {
    const field = G.currentField(state); const gain = G.fieldReward(state);
    if (!field || gain.lt(1)) return;
    if (!await ask(`Complete ${field.name} for +${gain.format(0)} FE${field.id === 'mature' ? '' : ' and apply its permanent reward'}?`, 'Complete this Field?')) return;
    const result = G.completeField(state); if (!result.ok) return;
    save(); render();
    M?.numberPulse?.('heroFeValue', 'field-complete');
    M?.atlasEvent?.('field-complete');
    M?.transition?.('field-complete', { eyebrow:field.id === 'mature' ? 'MATURE FIELD COMPLETE' : 'FIELD SEALED', title:field.name, detail:`+${result.gain.format(0)} Field Experience${field.id === 'mature' ? '' : ' · permanent learning retained'}`, duration:1050 });
    Q?.play?.('fieldComplete');
    toast(`${field.name} cleared · +${result.gain.format(0)} FE`);
  };

  $('legacyResetBtn').onclick = async () => {
    const gain = G.legacyGain(state); if (gain.lt(1)) return;
    const readiness = G.legacyReadiness(state);
    if (readiness.status === 'early' && state.system?.confirmEarlyResets !== false && !await ask(`This repeat Legacy era is compressed and currently worth ${gain.format(0)} L. Waiting toward 30 hours improves Legacy readiness. Establish it anyway?`, 'Review this departure')) return;
    if (!await ask(`Establish this Legacy for +${gain.format(0)} L? Current TI, NC, FE, and lower-layer development reset. Canonical Field clears and permanent Field rewards remain.`, 'Establish Legacy?')) return;
    const result = G.completeLegacy(state); if (!result.ok) return;
    save(); render();
    M?.numberPulse?.('heroLegacyValue', 'legacy');
    M?.atlasEvent?.('legacy');
    M?.transition?.('legacy', { eyebrow:'LEGACY ESTABLISHED', title:`+${result.gain.format(0)} Legacy`, detail:'Solved work compresses into durable starting conditions for the next era.', duration:1250 });
    Q?.play?.('legacy');
    toast(`Legacy established · +${result.gain.format(0)} L`);
  };

  $('completeCampaignBtn').onclick = async () => {
    if (!G.finalSequenceAvailable(state) || state.campaign.complete) return;
    if (!await ask('Complete the “To Every Nation” campaign sequence? You can continue reviewing the finished game afterward.', 'Complete the campaign?')) return;
    if (G.completeCampaign(state)) {
      phase5Shown = true;
      save(); render();
      M?.atlasEvent?.('legacy');
      M?.transition?.('campaign', {
        eyebrow:'CAMPAIGN COMPLETE',
        title:'To Every Nation',
        detail:'The designed campaign map is complete. The horizon beyond the game remains worship and faithful real-world witness.',
        duration:2200,
        announce:'Campaign complete. To Every Nation.',
        onDone:() => {}
      });
      Q?.play?.('campaign', { intensity:1.18, cooldown:0 });
    }
  };

  $('continueBtn').onclick = () => closeModalToTab('completionModal', 'insight');
  $('masteryContinueBtn').onclick = () => closeModalToTab('masteryModal', 'network');
  $('phase3ContinueBtn').onclick = () => closeModalToTab('phase3Modal', 'fields');
  $('phase4ContinueBtn').onclick = () => closeModalToTab('phase4Modal', 'legacy');
  $('openFieldsBtn').onclick = () => switchTab('fields');
  $('openLegacyBtn').onclick = () => switchTab('legacy');
  $('phase5ContinueBtn').onclick = () => closeModalToTab('phase5Modal', 'scripture');
  $('offlineContinueBtn').onclick = () => closeModal('offlineModal');

  function updateAutoFromInputs() {
    if (!state.automation.translation) return;
    G.setAutoSettings(state, { enabled: $('autoEnabled').checked, minRun: Number($('autoMinRun').value), resetMultiple: Number($('autoMultiple').value), maxRun: Number($('autoMaxRun').value) });
    save(false); render();
  }
  ['autoEnabled','autoMinRun','autoMultiple','autoMaxRun'].forEach(id => $(id).addEventListener(id === 'autoEnabled' ? 'change' : 'input', updateAutoFromInputs));

  function updateSystemControls() {
    G.setAutomationControls(state, { baseEnabled: $('controlBaseAutomation').checked, projectsEnabled: $('controlProjectAutomation').checked, translationEnabled: $('controlTranslationAutomation').checked });
    G.setSystemSettings(state, { offlineEnabled: $('offlineEnabled').checked, offlineCapSeconds: Number($('offlineCap').value), keyboardShortcuts: $('keyboardShortcuts').checked, confirmEarlyResets: $('confirmEarlyResets').checked });
    save(false); render();
  }
  ['controlBaseAutomation','controlProjectAutomation','controlTranslationAutomation','offlineEnabled','offlineCap','keyboardShortcuts','confirmEarlyResets'].forEach(id => $(id).addEventListener('change', updateSystemControls));

  ['motionPreference','textScale','contrastPreference'].forEach(id => $(id)?.addEventListener('change', () => {
    uiPrefs = {
      motion: $('motionPreference')?.value || 'system',
      textScale: $('textScale')?.value || '100',
      contrast: $('contrastPreference')?.value || 'system'
    };
    applyUiPreferences({ persist: true, announce: true });
    renderSystem();
  }));

  $('validateSaveBtn').onclick = () => {
    const validation = G.validateStatePayload(JSON.parse(G.serializeState(state)));
    const health = saveHealthText(true);
    toast(validation.ok && health.primary === 'valid' ? 'Current state and stored save are valid' : 'Save validation found a problem');
    renderSystem();
  };
  $('restoreBackupBtn').onclick = async () => {
    const raw = storageGet(BACKUP_KEY); if (!raw) return;
    try {
      const parsed = parseSaveText(raw);
      if (!await ask('Restore the recovery backup? Your current primary save will be replaced.', 'Restore recovery snapshot?')) return;
      state = parsed.state; saveQuarantined = false; M?.seed?.(state, G); Q?.seed?.(state, G); window.WTTNSettlement?.seed(); currentDisclosure = D.getDisclosure(state, G);
      masteryShown = !!state.phase2Complete; phase3Shown = !!state.phase3Complete; phase4Shown = !!state.phase4Complete; phase5Shown = !!state.phase5Complete;
      lastAtlasSignature = ''; state.records.saveRecoveries = (state.records.saveRecoveries || 0) + 1;
      save(false, { backup: false }); render(); toast('Recovery backup restored');
    } catch (err) { alert(`Backup could not be restored: ${err.message || err}`); }
  };

  function showOfflineSummary(summary, lead = null) {
    if (!summary || summary.simulatedSeconds < 60) return;
    lastFocusedBeforeModal = document.activeElement;
    $('offlineLead').textContent = lead || (summary.cappedSeconds > 0
      ? `You were away for ${fmtTime(summary.requestedSeconds)}. ${fmtTime(summary.simulatedSeconds)} was simulated; the configured cap skipped ${fmtTime(summary.cappedSeconds)}.`
      : `You were away for ${fmtTime(summary.requestedSeconds)}. Your unlocked automation continued through the normal economy.`);
    paint($('offlineSummary'),()=>window.WTTNSecondaryScreens.recap(state,summary,readableAmount));
    $('offlineNextBtn').textContent=window.WTTNSettlementModel.chapter(state).action;
    $('offlineNextBtn').onclick=()=>{closeModal('offlineModal');window.WTTNSettlement.nextAction();};
    openModal('offlineModal', 'offlineContinueBtn');
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallUi();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallUi('Installed successfully · your save remains local to this browser profile.');
    toast('Word to the Nations installed');
  });
  window.addEventListener('online', () => updateInstallUi());
  window.addEventListener('offline', () => updateInstallUi());
  const hadControllerAtBoot = !!navigator.serviceWorker?.controller;
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (!hadControllerAtBoot) { updateInstallUi(); return; }
    if (reloadingForUpdate) return;
    if (!save(false)) { updateInstallUi('Update ready; export your progress before reloading.'); return; }
    reloadingForUpdate = true;
    location.reload();
  });
  $('installAppBtn').onclick = requestInstall;
  $('installTopBtn').onclick = requestInstall;
  $('updateAppBtn').onclick = () => {
    if (!swRegistration?.waiting) return;
    if (!save(true)) { updateInstallUi('Export your save before updating; local saving is unavailable.'); return; }
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    updateInstallUi('Applying update…');
  };

  document.addEventListener('keydown', e => {
    if (trapModalTab(e)) return;
    // Native dialogs own Escape and all other keyboard interaction. Do not let
    // shortcuts change the campaign underneath an import or confirmation.
    if (document.querySelector('dialog[open]')) return;
    const target = e.target;
    const typing = target && (target.matches?.('input,select,textarea') || target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(true); return; }
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')].pop();
      if (open) { e.preventDefault(); closeModal(open.id); return; }
      if ($('mobileMenuButton')?.getAttribute('aria-expanded') === 'true') { e.preventDefault(); setMobileActionsOpen(false); $('mobileMenuButton').focus(); }
      return;
    }
    if (typing || document.querySelector('.modal-backdrop:not(.hidden)') || state.system?.keyboardShortcuts === false) return;
    if (e.altKey && /^[0-9]$/.test(e.key)) {
      const visible = tabs.filter(tab => D.isTabVisible(currentDisclosure, tab.dataset.tab));
      const digit = Number(e.key); const index = digit === 0 ? 9 : digit - 1;
      if (visible[index]) { e.preventDefault(); switchTab(visible[index].dataset.tab); (visible[index].getClientRects().length ? visible[index] : $('panelHeading')).focus({preventScroll:true}); }
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'b') {
      const options = G.hasBuyMax(state) ? ['1','10','max'] : ['1','10'];
      buyAmount = options[(options.indexOf(buyAmount) + 1) % options.length]; render();
    }
  });

  function frame(now) {
    if (document.hidden) { rafId = null; return; }
    const elapsed = Math.min(1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    accumulator += elapsed;
    if (accumulator >= .1) { G.tick(state, accumulator); accumulator = 0; }
    if (now - lastUi > 500) { render(); lastUi = now; }
    rafId = requestAnimationFrame(frame);
  }

  function startFrameLoop() {
    if (SMOKE_MODE || document.hidden || rafId != null) return;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stopFrameLoop() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (!SMOKE_MODE) {
    window.addEventListener('beforeunload', () => save(false));
    window.addEventListener('pagehide', () => save(false));
    setInterval(() => save(false), 10000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { suspendedAt = Date.now(); stopFrameLoop(); save(false); return; }
      if (suspendedAt) {
        const gap = Math.max(0, (Date.now() - suspendedAt) / 1000); suspendedAt = null;
        if (state.system?.offlineEnabled && gap >= 5) showOfflineSummary(simulateOfflineWithPresentation(gap), `The app was suspended for ${fmtTime(gap)}. Progress was simulated using the same rules as a closed app.`);
        lastFrame = performance.now(); accumulator = 0; save(false, { backup: false }); render();
      }
      swRegistration?.update?.().catch(() => {});
      startFrameLoop();
    });
  }

  window.WTTNSecondaryScreens.init();
  window.WTTNSettlement.init({
    getState: () => state, getBuyAmount: () => buyAmount, setBuyAmount: value => { buyAmount = value; render(); }, render, save: () => save(false), open: switchTab, toast,
    sound: type => Q?.play?.(type), modal: openModal,
    reduced: prefersReducedMotion, format: readableAmount
  });
  applyUiPreferences();
  const overview = $('campaignOverview');
  const overviewPreference = storageGet('wttn.overview.open.v1');
  overview.open = overviewPreference == null ? false : overviewPreference === 'true';
  overview.addEventListener('toggle', () => storageSet('wttn.overview.open.v1', String(overview.open)));
  document.body.dataset.activeTab = 'work';
  const setNavigationOrientation = () => $('gameTabs').setAttribute('aria-orientation', 'horizontal');
  setNavigationOrientation(); window.addEventListener('resize', setNavigationOrientation, {passive:true});
  installPlatformListeners();
  wireAtlasInteraction();
  setAtlasScale(1, { announce: false });
  render();
  save(false, { backup: false });
  registerPwa();
  document.documentElement.dataset.wttnReady = 'true';
  if (loaded.recovered) toast('Primary save was invalid; recovery backup loaded');
  if (pendingOfflineSummary) showOfflineSummary(pendingOfflineSummary);
  startFrameLoop();
  window.WTTN_READY = true;
  document.documentElement.dataset.boot = 'ready';
  // The actual save and its read-back above determine status. A second probe
  // can fail at the storage limit even when replacing the real save succeeded.
  if (saveQuarantined) setStorageWarning('Your stored save needs recovery. Autosaving is paused to protect it. Export your current progress, then use the recovery tools in System.');

})();
