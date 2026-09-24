(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WTTNMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRODUCER_MILESTONES = [10, 25, 50, 100, 250, 500];
  const KINDS = new Set(['work','project','translation','network','field-enter','field-complete','legacy','library','campaign','unlock']);
  let lastSnapshot = null;
  let layer = null;
  let announce = null;
  let cleanupTimers = new Set();

  const doc = () => typeof document !== 'undefined' ? document : null;
  const win = () => typeof window !== 'undefined' ? window : null;
  const byId = id => doc()?.getElementById(id) || null;

  function prefersReducedMotion() {
    try {
      if (doc()?.documentElement?.dataset?.motion === 'reduce') return true;
      return !!win()?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }
    catch { return false; }
  }

  function milestoneLevel(owned) {
    let level = 0;
    for (const n of PRODUCER_MILESTONES) if (owned >= n) level++;
    return level;
  }

  function snapshot(state, G) {
    const libraryIds = G?.SCRIPTURE_COLLECTIONS
      ? G.SCRIPTURE_COLLECTIONS.filter(c => !!state.library?.[c.id]).map(c => c.id)
      : Object.entries(state.library || {}).filter(([, value]) => !!value).map(([id]) => id);
    const libraryCount = libraryIds.length;
    const projectIds = Object.entries(state.projects || {}).filter(([, value]) => !!value).map(([id]) => id);
    const producerMilestones = {};
    for (const [id, owned] of Object.entries(state.producers || {})) producerMilestones[id] = milestoneLevel(Number(owned) || 0);
    return {
      translations: Number(state.translations || 0),
      networks: Number(state.networks || 0),
      fieldIndex: Number(state.field?.index || 0),
      fieldActive: !!state.field?.active,
      matureClears: Number(state.field?.matureClears || 0),
      legacies: Number(state.legacies || 0),
      libraryCount,
      libraryIds,
      phase2Complete: !!state.phase2Complete,
      phase3Complete: !!state.phase3Complete,
      phase4Complete: !!state.phase4Complete,
      campaignComplete: !!state.campaign?.complete,
      projectIds,
      producerMilestones
    };
  }

  function diffSnapshots(previous, current) {
    if (!previous) return [];
    const events = [];
    if (current.translations > previous.translations) events.push({ type: 'translation-cycle', count: current.translations - previous.translations });
    const previousProjects = new Set(previous.projectIds || []);
    const newProjects = (current.projectIds || []).filter(id => !previousProjects.has(id));
    for (const id of newProjects) events.push({ type: 'project-complete', id });
    if (current.phase2Complete && !previous.phase2Complete) events.push({ type: 'unlock', system: 'network' });
    if (current.phase3Complete && !previous.phase3Complete) events.push({ type: 'unlock', system: 'fields' });
    if (current.phase4Complete && !previous.phase4Complete) events.push({ type: 'unlock', system: 'legacy' });
    if (current.libraryCount > previous.libraryCount) {
      const previousIds = new Set(previous.libraryIds || []);
      const ids = (current.libraryIds || []).filter(id => !previousIds.has(id));
      events.push({ type: 'library', count: current.libraryCount - previous.libraryCount, ids });
    }
    if (current.campaignComplete && !previous.campaignComplete) events.push({ type: 'campaign' });
    for (const [id, level] of Object.entries(current.producerMilestones || {})) {
      const before = previous.producerMilestones?.[id] || 0;
      if (level > before) events.push({ type: 'producer-milestone', id, level, threshold: PRODUCER_MILESTONES[level - 1] });
    }
    return events;
  }

  function ensureLayer() {
    const d = doc();
    if (!d) return null;
    if (layer?.isConnected) return layer;
    layer = d.getElementById('gameFeelLayer');
    if (!layer) {
      layer = d.createElement('div');
      layer.id = 'gameFeelLayer';
      layer.className = 'game-feel-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<div class="feel-vignette"></div><div id="feelTransition" class="feel-transition"></div><div id="feelParticles" class="feel-particles"></div>';
      d.body.appendChild(layer);
    }
    announce = d.getElementById('motionAnnounce');
    if (!announce) {
      announce = d.createElement('div');
      announce.id = 'motionAnnounce';
      announce.className = 'sr-only';
      announce.setAttribute('aria-live', 'polite');
      announce.setAttribute('aria-atomic', 'true');
      d.body.appendChild(announce);
    }
    return layer;
  }

  function setTimer(fn, ms) {
    const id = setTimeout(() => { cleanupTimers.delete(id); fn(); }, ms);
    cleanupTimers.add(id);
    return id;
  }

  function retrigger(el, cls, ms = 650) {
    if (!el || prefersReducedMotion()) return false;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimer(() => el.classList.remove(cls), ms);
    return true;
  }

  function announceText(text) {
    if (!text) return;
    ensureLayer();
    if (!announce) return;
    announce.textContent = '';
    setTimer(() => { announce.textContent = String(text); }, 10);
  }

  function floatingLabel(anchor, text, tone = 'work') {
    const d = doc();
    if (!d || !anchor || prefersReducedMotion()) return;
    ensureLayer();
    const rect = anchor.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > win().innerHeight) return;
    const el = d.createElement('span');
    el.className = `feel-float feel-tone-${KINDS.has(tone) ? tone : 'work'}`;
    el.textContent = text;
    layer.appendChild(el);
    const half = Math.min(el.offsetWidth / 2, win().innerWidth / 2 - 12);
    el.style.left = `${Math.min(win().innerWidth - half - 12, Math.max(half + 12, rect.left + rect.width / 2))}px`;
    el.style.top = `${Math.min(win().innerHeight - el.offsetHeight - 12, Math.max(42, rect.top + Math.min(52, rect.height * .45)))}px`;
    setTimer(() => el.remove(), 900);
  }

  function burst(anchor, tone = 'work', count = 7) {
    const d = doc();
    if (!d || !anchor || prefersReducedMotion()) return;
    ensureLayer();
    const rect = anchor.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + Math.min(rect.height / 2, 70);
    for (let i = 0; i < count; i++) {
      const dot = d.createElement('i');
      dot.className = `feel-particle feel-tone-${KINDS.has(tone) ? tone : 'work'}`;
      const angle = (-145 + (290 / Math.max(1, count - 1)) * i) * Math.PI / 180;
      const distance = 26 + (i % 3) * 9;
      dot.style.left = `${cx}px`;
      dot.style.top = `${cy}px`;
      dot.style.setProperty('--feel-x', `${Math.cos(angle) * distance}px`);
      dot.style.setProperty('--feel-y', `${Math.sin(angle) * distance}px`);
      layer.appendChild(dot);
      setTimer(() => dot.remove(), 720);
    }
  }

  function cardFeedback(target, { label = null, tone = 'work', milestone = false } = {}) {
    const el = typeof target === 'string' ? (target.startsWith('#') ? doc()?.querySelector(target) : byId(target)) : target;
    if (!el) return;
    retrigger(el, milestone ? 'feel-milestone-hit' : 'feel-purchased', milestone ? 980 : 520);
    if (milestone) burst(el, tone, 9);
    if (label) floatingLabel(el, label, tone);
  }

  function numberPulse(target, tone = 'work') {
    const el = typeof target === 'string' ? byId(target) || doc()?.querySelector(target) : target;
    if (!el) return;
    retrigger(el, `feel-number-pulse`, 520);
    el.dataset.feelTone = tone;
    setTimer(() => { if (el.dataset.feelTone === tone) delete el.dataset.feelTone; }, 540);
  }

  function atlasEvent(kind = 'unlock') {
    const atlas = byId('missionAtlas');
    if (!atlas) return;
    const cls = `feel-atlas-${kind}`;
    retrigger(atlas, cls, kind === 'legacy' ? 1500 : 1050);
  }

  function transition(kind, { eyebrow = '', title = '', detail = '', duration = 1050, announce: announcement = null, onDone = null } = {}) {
    ensureLayer();
    const el = byId('feelTransition');
    if (!el) { onDone?.(); return; }
    const safeKind = KINDS.has(kind) ? kind : 'unlock';
    announceText(announcement || [eyebrow, title].filter(Boolean).join('. '));
    const buildTransition = reduced => {
      el.textContent = '';
      if (!reduced) {
        const lines = doc().createElement('div');
        lines.className = 'feel-transition-lines';
        lines.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 3; i++) lines.appendChild(doc().createElement('i'));
        el.appendChild(lines);
      }
      const card = doc().createElement('div');
      card.className = 'feel-transition-card';
      const overline = doc().createElement('span'); overline.textContent = String(eyebrow || '');
      const heading = doc().createElement('strong'); heading.textContent = String(title || '');
      card.append(overline, heading);
      if (detail) { const small = doc().createElement('small'); small.textContent = String(detail); card.appendChild(small); }
      el.appendChild(card);
    };
    if (prefersReducedMotion()) {
      el.className = `feel-transition feel-transition-${safeKind} is-reduced`;
      buildTransition(true);
      el.classList.add('is-visible');
      setTimer(() => { el.classList.remove('is-visible'); el.textContent = ''; onDone?.(); }, Math.min(420, duration));
      return;
    }
    el.className = `feel-transition feel-transition-${safeKind}`;
    buildTransition(false);
    void el.offsetWidth;
    el.classList.add('is-visible');
    setTimer(() => el.classList.add('is-leaving'), Math.max(420, duration - 320));
    setTimer(() => {
      el.classList.remove('is-visible', 'is-leaving');
      el.textContent = '';
      onDone?.();
    }, duration);
  }

  function modalReveal(id) {
    const modal = byId(id);
    if (!modal || prefersReducedMotion()) return;
    retrigger(modal.querySelector('.modal'), 'feel-modal-arrive', 650);
  }

  function allocationChanged(channel) {
    const card = doc()?.querySelector(`.allocation-card[data-channel="${channel}"]`) || doc()?.querySelector(`[data-allocation-plus="${channel}"]`)?.closest('.allocation-card');
    if (card) cardFeedback(card, { tone: 'network' });
    atlasEvent('network');
  }

  function reconcile(state, G) {
    const current = snapshot(state, G);
    const events = diffSnapshots(lastSnapshot, current);
    lastSnapshot = current;
    if (!events.length) return events;
    for (const event of events) {
      if (event.type === 'translation-cycle') {
        atlasEvent('translation');
        numberPulse('heroTiValue', 'translation');
      } else if (event.type === 'project-complete') {
        cardFeedback(`project-${event.id}`, { label: 'Project complete', tone: 'project', milestone: true });
      } else if (event.type === 'producer-milestone') {
        cardFeedback(`producer-${event.id}`, { label: `${event.threshold} milestone`, tone: 'work', milestone: true });
        announceText(`${event.id} reached the ${event.threshold} milestone.`);
      } else if (event.type === 'library') {
        const tab = doc()?.querySelector('.tab[data-tab="scripture"]');
        if (tab) cardFeedback(tab, { label: 'Library updated', tone: 'library', milestone: true });
        for (const id of event.ids || []) cardFeedback(`scripture-${id}`, { label: 'Collection unlocked', tone: 'library', milestone: true });
      } else if (event.type === 'unlock') {
        const tab = doc()?.querySelector(`.tab[data-tab="${event.system}"]`);
        if (tab) cardFeedback(tab, { label: 'New system', tone: 'unlock', milestone: true });
      }
    }
    return events;
  }

  function seed(state, G) { lastSnapshot = snapshot(state, G); return lastSnapshot; }

  function clear() {
    for (const id of cleanupTimers) clearTimeout(id);
    cleanupTimers.clear();
    lastSnapshot = null;
    layer?.remove(); layer = null;
    announce?.remove(); announce = null;
  }

  return {
    version: '1.6.0',
    PRODUCER_MILESTONES,
    prefersReducedMotion,
    milestoneLevel,
    snapshot,
    diffSnapshots,
    ensureLayer,
    seed,
    reconcile,
    cardFeedback,
    numberPulse,
    floatingLabel,
    burst,
    atlasEvent,
    transition,
    modalReveal,
    allocationChanged,
    announceText,
    clear
  };
});
