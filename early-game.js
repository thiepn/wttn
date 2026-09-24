(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WTTNEarlyGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const version = '1.8.0';
  const FIRST_WINDOW_SECONDS = 25 * 60;

  function anyMethod(state) {
    return Object.values(state.pageUpgrades || {}).some(v => !!v);
  }

  function firstRunActive(state) {
    return Number(state.translations || 0) === 0 && !(state.lifetimeTi?.gt?.(0));
  }

  function completedObjectives(state, G) {
    const threshold = G.translationThreshold(state);
    return {
      scribe: (state.producers?.scribe || 0) > 0,
      copyist: (state.producers?.copyist || 0) > 0,
      method: anyMethod(state),
      editor: (state.producers?.editor || 0) > 0,
      teacher: (state.producers?.teacher || 0) > 0,
      manuscript: !!state.projects?.manuscript,
      workshop: (state.producers?.workshop || 0) > 0,
      reference: !!state.projects?.reference,
      teaching: !!state.projects?.teaching,
      scriptorium: (state.producers?.scriptorium || 0) > 0,
      threshold: state.peakPages?.gte?.(threshold) || false,
      developing: state.peakPages?.gte?.(threshold) && state.runTime >= 20 * 60,
      mature: state.peakPages?.gte?.(threshold) && state.runTime >= FIRST_WINDOW_SECONDS
    };
  }

  function chapterState(current, ids) {
    const count = ids.filter(id => current[id]).length;
    return count === ids.length ? 'complete' : count > 0 ? 'current' : 'upcoming';
  }

  function getChapters(state, G) {
    const c = completedObjectives(state, G);
    const chapters = [
      { id:'foundation', label:'Establish the work', state:chapterState(c,['scribe','copyist','method','editor','teacher']) },
      { id:'projects', label:'Complete Projects', state:chapterState(c,['manuscript','reference','teaching']) },
      { id:'scriptorium', label:'Reach Translation', state:chapterState(c,['workshop','scriptorium','threshold']) },
      { id:'translation', label:'Choose the reset', state:c.mature ? 'complete' : c.threshold ? 'current' : 'upcoming' }
    ];
    // Only one unfinished chapter should read as current.
    let found = false;
    for (const ch of chapters) {
      if (ch.state === 'complete') continue;
      if (!found) { ch.state = 'current'; found = true; }
      else if (ch.state === 'current') ch.state = 'upcoming';
    }
    return chapters;
  }

  function metric(label, value) { return [label, String(value)]; }

  function getGuide(state, G) {
    if (!firstRunActive(state)) return { active:false, version };
    const c = completedObjectives(state, G);
    const pps = G.pageProduction(state);
    const gain = G.translationGain(state);
    const readiness = G.translationReadiness(state);
    const run = Math.max(0, Number(state.runTime || 0));
    const common = { active:true, version, chapters:getChapters(state,G), completed:c };

    if (!c.scribe) return { ...common, chapter:'Establish the work', title:'Buy your first Scribe.', summary:'Pages accumulate automatically. As soon as you can afford a Scribe, buy one to begin the production chain.', tip:'Early producers are permanent only for this run; rebuilding is part of the first Translation lesson.', action:{label:'Focus Scribe',tab:'work',target:'producer-scribe'}, metrics:[metric('Pages',state.pages.format(0)),metric('Production',`${pps.format(1)} P/s`),metric('Cost','10 P')] };
    if (!c.copyist) return { ...common, chapter:'Establish the work', title:'Add a Copyist.', summary:'Higher producer tiers are usually the fastest way to accelerate the next stretch. Build toward the first Copyist.', tip:'Do not wait for huge piles of Pages early; reinvesting into higher tiers is the core loop.', action:{label:'Focus Copyist',tab:'work',target:'producer-copyist'}, metrics:[metric('Pages',state.pages.format(0)),metric('Scribes',state.producers.scribe),metric('Next tier','Copyist')] };
    if (!c.method) return { ...common, chapter:'Establish the work', title:'Try your first Method.', summary:'Methods are one-run improvements. They reset when you Translate, so use affordable ones to speed the current run.', tip:'Permanent development arrives after the first Translation; Methods are intentionally temporary.', action:{label:'Review Methods',tab:'work',target:'methodsWorkspace'}, metrics:[metric('Pages',state.pages.format(0)),metric('Production',`${pps.format(1)} P/s`),metric('First Method','Organized Desk')] };
    if (!c.editor) return { ...common, chapter:'Establish the work', title:'Extend the chain to Editors.', summary:'Editors are the first large jump in the production ladder. Keep reinvesting instead of saving Pages passively.', tip:'Producer milestones at 10 / 25 / 50 / 100 / 250 / 500 create additional bursts of progress.', action:{label:'Focus Editor',tab:'work',target:'producer-editor'}, metrics:[metric('Copyists',state.producers.copyist),metric('Production',`${pps.format(1)} P/s`),metric('Next tier','Editor')] };
    if (!c.teacher) return { ...common, chapter:'Establish the work', title:'Reach the Teacher tier.', summary:'Teachers complete the first production foundation and prepare the run for its Project objectives.', tip:'The Projects tab is your next major source of one-run progress.', action:{label:'Focus Teacher',tab:'work',target:'producer-teacher'}, metrics:[metric('Editors',state.producers.editor),metric('Production',`${pps.format(1)} P/s`),metric('Next tier','Teacher')] };
    if (!c.manuscript) return { ...common, chapter:'Complete Projects', title:'Prepare the Manuscript Project.', summary:'Projects are run objectives. Their rewards last for this Translation run and create clear mid-run milestones.', tip:'When a Project turns Ready, completing it is usually more valuable than waiting.', action:{label:'Open Projects',tab:'projects',target:'project-manuscript'}, metrics:[metric('Peak Pages',state.peakPages.format(2)),metric('Projects','0 / 3'),metric('Production',`${pps.format(2)} P/s`)] };
    if (!c.workshop) return { ...common, chapter:'Complete Projects', title:'Build toward a Workshop.', summary:'The first Project is complete. Expand the producer ladder while the next Project requirement comes into reach.', tip:'Projects and producer tiers are meant to interleave; neither should be ignored.', action:{label:'Focus Workshop',tab:'work',target:'producer-workshop'}, metrics:[metric('Projects','1 / 3'),metric('Teachers',state.producers.teacher),metric('Production',`${pps.format(2)} P/s`)] };
    if (!c.reference) return { ...common, chapter:'Complete Projects', title:'Complete the Reference Project.', summary:'Your production foundation is strong enough for the second Project. Check its requirement list and complete it when ready.', tip:'Reference Project strengthens producer synergy for the remainder of this run.', action:{label:'Open Reference Project',tab:'projects',target:'project-reference'}, metrics:[metric('Projects','1 / 3'),metric('Peak Pages',state.peakPages.format(2)),metric('Production',`${pps.format(2)} P/s`)] };
    if (!c.teaching) return { ...common, chapter:'Complete Projects', title:'Finish the Teaching Collection.', summary:'This is the final Project before the first Translation. Finish the objective while continuing to build higher producer tiers.', tip:'After all three Projects, the run shifts from objectives toward the final production climb.', action:{label:'Open Teaching Collection',tab:'projects',target:'project-teaching'}, metrics:[metric('Projects','2 / 3'),metric('Teachers',state.producers.teacher),metric('Peak Pages',state.peakPages.format(2))] };
    if (!c.scriptorium) return { ...common, chapter:'Reach Translation', title:'Establish the first Scriptorium.', summary:'All Projects are complete. The Scriptorium is the final producer tier and the clearest bridge into the Translation threshold.', tip:'This is the intentionally quieter expansion stretch: watch high-tier purchases and milestones rather than waiting on one giant button.', action:{label:'Focus Scriptorium',tab:'work',target:'producer-scriptorium'}, metrics:[metric('Projects','3 / 3'),metric('Production',`${pps.format(2)} P/s`),metric('Peak Pages',state.peakPages.format(2))] };
    if (!c.threshold) return { ...common, chapter:'Reach Translation', title:'Push peak Pages to the Translation threshold.', summary:'The full production chain is online. Keep reinvesting until peak Pages reach the first Translation boundary.', tip:'The top progress bar uses orders of magnitude, so each visible step represents meaningful exponential progress.', action:{label:'Review production',tab:'work',target:'producerWorkspace'}, metrics:[metric('Peak Pages',state.peakPages.format(2)),metric('Target',G.translationThreshold(state).format(2)),metric('Production',`${pps.format(2)} P/s`)] };
    if (!c.developing) return { ...common, chapter:'Choose the reset', title:`Translation is available now for ${gain.format(0)} TI.`, summary:'You can reset immediately, but the first run is intentionally more rewarding if you let it mature toward the 20–30 minute window.', tip:'Nothing is wrong if you wait here: TI gain is still increasing, and the first reset determines how strong your permanent start will be.', action:{label:'Review Translation',tab:'translation',target:'translationResetWorkspace'}, metrics:[metric('Gain now',`${gain.format(0)} TI`),metric('Readiness',`${Math.round(readiness.score*100)}%`),metric('Run time',formatShort(run))] };
    if (!c.mature) return { ...common, chapter:'Choose the reset', title:'The first Translation is nearly mature.', summary:'You are close to the intended first-reset window. A little more time now produces a noticeably stronger first permanent currency grant.', tip:'The first reset is a strategic choice, not a hard timer; the game never locks you out of resetting early.', action:{label:'Review reset',tab:'translation',target:'translateBtn'}, metrics:[metric('Gain now',`${gain.format(0)} TI`),metric('Readiness',`${Math.round(readiness.score*100)}%`),metric('Recommended','20–30 min')] };
    return { ...common, chapter:'Choose the reset', title:`Complete your first Translation for ${gain.format(0)} TI.`, summary:'The run is in the intended first-Translation window. Reset when you are ready to trade temporary setup for permanent Translation Insight.', tip:'After this reset, the first-run guide disappears and the game begins revealing its permanent systems.', action:{label:'Complete first Translation',tab:'translation',target:'translateBtn'}, metrics:[metric('Gain now',`${gain.format(0)} TI`),metric('Readiness','Mature'),metric('Run time',formatShort(run))], tone:'ready' };
  }

  function formatShort(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  return { version, FIRST_WINDOW_SECONDS, firstRunActive, completedObjectives, getChapters, getGuide };
});
