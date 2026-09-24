(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WTTNAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.7.0';
  const STORAGE_KEY = 'wttn.audio.v1';
  const DEFAULTS = Object.freeze({
    enabled: false,
    master: 0.46,
    ui: 0.42,
    milestones: 0.58,
    ambient: 0.22,
    ambientEnabled: false
  });
  const CATEGORIES = new Set(['ui','milestones','ambient']);
  const CUES = Object.freeze({
    purchase: { category:'ui', kind:'tick', pitch:310, gain:.22 },
    method: { category:'ui', kind:'double', pitch:350, gain:.22 },
    project: { category:'milestones', kind:'paper-chime', pitch:440, gain:.32 },
    practice: { category:'ui', kind:'double', pitch:390, gain:.18 },
    unlock: { category:'milestones', kind:'chime', pitch:494, gain:.30 },
    select: { category:'ui', kind:'soft', pitch:330, gain:.18 },
    allocation: { category:'ui', kind:'route', pitch:280, gain:.16 },
    translation: { category:'milestones', kind:'paper-rise', pitch:392, gain:.36 },
    network: { category:'milestones', kind:'route-rise', pitch:330, gain:.36 },
    fieldEnter: { category:'milestones', kind:'low-mark', pitch:196, gain:.30 },
    fieldComplete: { category:'milestones', kind:'seal', pitch:523, gain:.38 },
    legacy: { category:'milestones', kind:'legacy', pitch:220, gain:.42 },
    library: { category:'milestones', kind:'book', pitch:466, gain:.28 },
    campaign: { category:'milestones', kind:'finale', pitch:262, gain:.46 },
    save: { category:'ui', kind:'soft', pitch:294, gain:.12 }
  });

  let context = null;
  let masterGain = null;
  let categoryGains = {};
  let ambientNodes = null;
  let settings = null;
  let armed = false;
  let seeded = null;
  let lastCueAt = new Map();
  let bound = false;

  const win = () => typeof window !== 'undefined' ? window : null;
  const doc = () => typeof document !== 'undefined' ? document : null;
  const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

  function normalizeSettings(input = {}) {
    return {
      enabled: input.enabled === true,
      master: clamp01(input.master ?? DEFAULTS.master),
      ui: clamp01(input.ui ?? DEFAULTS.ui),
      milestones: clamp01(input.milestones ?? DEFAULTS.milestones),
      ambient: clamp01(input.ambient ?? DEFAULTS.ambient),
      ambientEnabled: input.ambientEnabled === true
    };
  }

  function loadSettings() {
    try {
      const raw = win()?.localStorage?.getItem(STORAGE_KEY);
      settings = normalizeSettings(raw ? JSON.parse(raw) : DEFAULTS);
    } catch { settings = normalizeSettings(DEFAULTS); }
    return { ...settings };
  }

  function saveSettings() {
    try { win()?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings)); }
    catch { /* preference persistence is best-effort */ }
  }

  function getSettings() {
    if (!settings) loadSettings();
    return { ...settings };
  }

  function createContext() {
    const W = win();
    if (!W) return null;
    const AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) return null;
    if (context) return context;
    try {
      context = new AC();
      masterGain = context.createGain();
      masterGain.gain.value = settings?.enabled ? (settings.master || 0) : 0;
      masterGain.connect(context.destination);
      for (const category of CATEGORIES) {
        const node = context.createGain();
        node.gain.value = settings?.[category] ?? DEFAULTS[category];
        node.connect(masterGain);
        categoryGains[category] = node;
      }
      return context;
    } catch { return null; }
  }

  async function unlock() {
    armed = true;
    if (!settings) loadSettings();
    if (!settings.enabled) return false;
    const ctx = createContext();
    if (!ctx) return false;
    try { if (ctx.state === 'suspended') await ctx.resume(); }
    catch { return false; }
    syncGains();
    syncAmbient();
    updateControlValues();
    return ctx.state === 'running';
  }

  function syncGains() {
    if (!context || !masterGain || !settings) return;
    const now = context.currentTime;
    masterGain.gain.setTargetAtTime(settings.enabled ? settings.master : 0, now, .02);
    for (const category of CATEGORIES) {
      categoryGains[category]?.gain.setTargetAtTime(settings[category] ?? 0, now, .02);
    }
  }

  function stopAmbient() {
    if (!ambientNodes) return;
    const now = context?.currentTime || 0;
    try { ambientNodes.gain.gain.setTargetAtTime(0, now, .08); }
    catch { /* ignore */ }
    setTimeout(() => {
      try { ambientNodes.oscillators.forEach(o => o.stop()); }
      catch { /* ignore */ }
      ambientNodes = null;
    }, 300);
  }

  function startAmbient() {
    if (!context || ambientNodes || !settings?.enabled || !settings.ambientEnabled || !armed) return;
    const bus = categoryGains.ambient;
    if (!bus) return;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    filter.Q.value = .3;
    gain.gain.value = 0;
    gain.connect(filter); filter.connect(bus);
    const freqs = [82.41, 123.47, 164.81];
    const oscillators = freqs.map((frequency, index) => {
      const osc = context.createOscillator();
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.value = frequency;
      osc.detune.value = index === 1 ? -4 : index === 2 ? 5 : 0;
      const g = context.createGain();
      g.gain.value = index === 0 ? .038 : .012;
      osc.connect(g); g.connect(gain); osc.start(); return osc;
    });
    ambientNodes = { gain, filter, oscillators };
    gain.gain.setTargetAtTime(.11, context.currentTime, .8);
  }

  function syncAmbient() {
    if (settings?.enabled && settings?.ambientEnabled && armed) startAmbient();
    else stopAmbient();
  }

  function setSettings(patch = {}, { persist = true } = {}) {
    if (!settings) loadSettings();
    settings = normalizeSettings({ ...settings, ...patch });
    if (persist) saveSettings();
    if (settings.enabled && armed) createContext();
    syncGains(); syncAmbient();
    updateControlValues();
    return getSettings();
  }

  function setEnabled(value) { return setSettings({ enabled: !!value }); }

  function envelope(gainNode, when, peak, attack = .008, decay = .18) {
    gainNode.gain.cancelScheduledValues(when);
    gainNode.gain.setValueAtTime(.0001, when);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), when + attack);
    gainNode.gain.exponentialRampToValueAtTime(.0001, when + attack + decay);
  }

  function tone(freq, when, duration, peak, category = 'ui', type = 'sine', destination = null) {
    if (!context) return;
    const osc = context.createOscillator();
    const g = context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, when);
    osc.connect(g); g.connect(destination || categoryGains[category] || masterGain);
    envelope(g, when, peak, .008, Math.max(.04, duration - .008));
    osc.start(when); osc.stop(when + duration + .03);
  }

  function noise(when, duration, peak, category = 'ui', cutoff = 1700) {
    if (!context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const edge = 1 - Math.abs((i / length) * 2 - 1);
      data[i] = (Math.random() * 2 - 1) * (.28 + .72 * edge);
    }
    const src = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const g = context.createGain();
    filter.type = 'bandpass'; filter.frequency.value = cutoff; filter.Q.value = .55;
    src.buffer = buffer; src.connect(filter); filter.connect(g); g.connect(categoryGains[category] || masterGain);
    envelope(g, when, peak, .004, Math.max(.05, duration - .004));
    src.start(when); src.stop(when + duration + .02);
  }

  function cueRecipe(def, intensity = 1) {
    if (!context) return;
    const t = context.currentTime + .006;
    const cat = def.category;
    const p = def.pitch;
    const g = def.gain * Math.max(.5, Math.min(1.3, intensity));
    switch (def.kind) {
      case 'tick':
        noise(t, .045, g * .15, cat, 2300); tone(p, t, .065, g * .13, cat, 'triangle'); break;
      case 'soft':
        tone(p, t, .12, g * .12, cat, 'triangle'); break;
      case 'double':
        tone(p, t, .09, g * .12, cat, 'triangle'); tone(p * 1.19, t + .075, .12, g * .11, cat, 'sine'); break;
      case 'paper-chime':
        noise(t, .16, g * .16, cat, 1450); tone(p, t + .07, .32, g * .13, cat, 'sine'); tone(p * 1.5, t + .12, .28, g * .08, cat, 'sine'); break;
      case 'chime':
        tone(p, t, .34, g * .15, cat, 'sine'); tone(p * 1.25, t + .09, .34, g * .11, cat, 'sine'); break;
      case 'route':
        tone(p, t, .09, g * .10, cat, 'triangle'); tone(p * 1.12, t + .055, .10, g * .09, cat, 'triangle'); break;
      case 'paper-rise':
        noise(t, .28, g * .15, cat, 1200); tone(p, t + .05, .42, g * .13, cat, 'sine'); tone(p * 1.25, t + .18, .48, g * .15, cat, 'sine'); tone(p * 1.5, t + .32, .54, g * .12, cat, 'sine'); break;
      case 'route-rise':
        tone(p, t, .34, g * .13, cat, 'triangle'); tone(p * 1.5, t + .10, .38, g * .12, cat, 'sine'); tone(p * 2, t + .22, .42, g * .09, cat, 'sine'); break;
      case 'low-mark':
        noise(t, .11, g * .10, cat, 900); tone(p, t, .42, g * .16, cat, 'triangle'); tone(p * 1.5, t + .16, .34, g * .09, cat, 'sine'); break;
      case 'seal':
        noise(t, .08, g * .19, cat, 750); tone(p, t + .04, .40, g * .17, cat, 'sine'); tone(p * .75, t + .15, .46, g * .10, cat, 'triangle'); break;
      case 'legacy':
        tone(p, t, .60, g * .16, cat, 'sine'); tone(p * 1.25, t + .14, .62, g * .13, cat, 'sine'); tone(p * 1.5, t + .30, .70, g * .11, cat, 'sine'); noise(t + .08, .38, g * .08, cat, 760); break;
      case 'book':
        noise(t, .20, g * .13, cat, 1550); tone(p, t + .10, .40, g * .11, cat, 'sine'); break;
      case 'finale':
        noise(t, .32, g * .10, cat, 1000);
        [1,1.25,1.5,2].forEach((ratio, i) => tone(p * ratio, t + i * .22, .72, g * (.14 - i*.015), cat, 'sine'));
        break;
      default: tone(p, t, .12, g * .1, cat, 'sine');
    }
  }

  function play(name, options = {}) {
    if (!settings) loadSettings();
    const def = CUES[name];
    if (!def || !settings.enabled || !armed) return false;
    const nowMs = Date.now();
    const cooldown = options.cooldown ?? (name === 'purchase' ? 45 : name === 'allocation' ? 70 : 120);
    if (nowMs - (lastCueAt.get(name) || 0) < cooldown) return false;
    lastCueAt.set(name, nowMs);
    const ctx = createContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    cueRecipe(def, options.intensity ?? 1);
    return true;
  }

  function snapshot(state, G) {
    const libraryIds = G?.SCRIPTURE_COLLECTIONS
      ? G.SCRIPTURE_COLLECTIONS.filter(c => !!state.library?.[c.id]).map(c => c.id)
      : Object.entries(state.library || {}).filter(([, value]) => !!value).map(([id]) => id);
    return {
      phase2Complete: !!state.phase2Complete,
      phase3Complete: !!state.phase3Complete,
      phase4Complete: !!state.phase4Complete,
      campaignComplete: !!state.campaign?.complete,
      libraryIds
    };
  }

  function diffSnapshots(before, after) {
    if (!before) return [];
    const events = [];
    if (after.phase2Complete && !before.phase2Complete) events.push({ type:'unlock', system:'network' });
    if (after.phase3Complete && !before.phase3Complete) events.push({ type:'unlock', system:'fields' });
    if (after.phase4Complete && !before.phase4Complete) events.push({ type:'unlock', system:'legacy' });
    const prior = new Set(before.libraryIds || []);
    for (const id of after.libraryIds || []) if (!prior.has(id)) events.push({ type:'library', id });
    if (after.campaignComplete && !before.campaignComplete) events.push({ type:'campaign' });
    return events;
  }

  function seed(state, G) { seeded = snapshot(state, G); return seeded; }
  function reconcile(state, G) {
    const next = snapshot(state, G);
    const events = diffSnapshots(seeded, next);
    seeded = next;
    if (!settings?.enabled || !armed) return events;
    for (const event of events) {
      // Secondary unlock cues arrive slightly after the primary gameplay action,
      // which keeps milestone audio layered rather than simultaneous/noisy.
      if (event.type === 'library') setTimeout(() => play('library', { cooldown: 250 }), 520);
      else if (event.type === 'unlock') setTimeout(() => play('unlock', { cooldown: 250 }), 260);
      // Campaign audio is explicitly played by the finale action to avoid double playback.
    }
    return events;
  }

  function updateControlValues() {
    const d = doc(); if (!d || !settings) return;
    const byId = id => d.getElementById(id);
    const map = [
      ['audioEnabled', 'enabled'], ['audioAmbientEnabled', 'ambientEnabled']
    ];
    for (const [id,key] of map) if (byId(id) && d.activeElement !== byId(id)) byId(id).checked = !!settings[key];
    for (const key of ['master','ui','milestones','ambient']) {
      const input = byId(`audio${key[0].toUpperCase()}${key.slice(1)}`);
      const label = byId(`audio${key[0].toUpperCase()}${key.slice(1)}Value`);
      if (input && d.activeElement !== input) input.value = String(Math.round(settings[key] * 100));
      if (label) label.textContent = `${Math.round(settings[key] * 100)}%`;
    }
    const status = byId('audioStatus');
    if (status) status.textContent = settings.enabled
      ? (armed ? 'Sound enabled · procedural audio is ready.' : 'Sound enabled · interact once to unlock browser audio.')
      : 'Sound is off by default. No audio plays until you enable it.';
  }

  function bindControls() {
    const d = doc(); if (!d || bound) return false;
    bound = true;
    const pairs = [
      ['audioEnabled', 'enabled', 'change'],
      ['audioAmbientEnabled', 'ambientEnabled', 'change'],
      ['audioMaster', 'master', 'input'],
      ['audioUi', 'ui', 'input'],
      ['audioMilestones', 'milestones', 'input'],
      ['audioAmbient', 'ambient', 'input']
    ];
    for (const [id,key,event] of pairs) {
      const el = d.getElementById(id); if (!el) continue;
      el.addEventListener(event, async () => {
        const value = el.type === 'checkbox' ? el.checked : Number(el.value) / 100;
        setSettings({ [key]: value });
        if ((key === 'enabled' && value) || (settings.enabled && !armed)) await unlock();
        if (key === 'ambientEnabled') syncAmbient();
        if (key === 'master' || key === 'ui' || key === 'milestones' || key === 'ambient') syncGains();
      });
    }
    d.getElementById('audioTestUi')?.addEventListener('click', async () => { await unlock(); play('purchase', { cooldown:0 }); });
    d.getElementById('audioTestMilestone')?.addEventListener('click', async () => { await unlock(); play('translation', { cooldown:0 }); });
    updateControlValues();
    return true;
  }

  function init() {
    loadSettings();
    const d = doc();
    if (d) {
      const gesture = async () => {
        if (!armed) await unlock();
      };
      d.addEventListener('pointerdown', gesture, { passive:true, capture:true });
      d.addEventListener('keydown', gesture, { capture:true });
      if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bindControls, { once:true });
      else bindControls();
    }
    return getSettings();
  }

  function destroy() {
    stopAmbient();
    try { context?.close?.(); } catch { /* ignore */ }
    context = null; masterGain = null; categoryGains = {}; armed = false; bound = false;
  }

  return {
    version: VERSION,
    storageKey: STORAGE_KEY,
    defaults: DEFAULTS,
    cues: CUES,
    normalizeSettings,
    getSettings,
    setSettings,
    setEnabled,
    init,
    unlock,
    play,
    seed,
    snapshot,
    diffSnapshots,
    reconcile,
    bindControls,
    destroy
  };
});
