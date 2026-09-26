'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const text = p => fs.readFileSync(path.join(ROOT,p),'utf8');
const M = require('../motion.js');

assert.strictEqual(M.version, '1.6.0');
assert.strictEqual(M.milestoneLevel(0), 0);
assert.strictEqual(M.milestoneLevel(10), 1);
assert.strictEqual(M.milestoneLevel(25), 2);
assert.strictEqual(M.milestoneLevel(500), 6);

const fakeG = { SCRIPTURE_COLLECTIONS:[{id:'torah'},{id:'acts'}] };
const base = {
  translations:0, networks:0, legacies:0, phase2Complete:false, phase3Complete:false, phase4Complete:false,
  campaign:{complete:false}, field:{index:0,active:false,matureClears:0},
  producers:{scribe:9,copyist:0}, projects:{manuscript:false}, library:{torah:false,acts:false}
};
const next = JSON.parse(JSON.stringify(base));
next.translations = 1;
next.phase2Complete = true;
next.producers.scribe = 10;
next.projects.manuscript = true;
next.library.torah = true;
const a = M.snapshot(base,fakeG), b = M.snapshot(next,fakeG);
const events = M.diffSnapshots(a,b);
assert(events.some(e => e.type === 'translation-cycle'));
assert(events.some(e => e.type === 'unlock' && e.system === 'network'));
assert(events.some(e => e.type === 'producer-milestone' && e.id === 'scribe' && e.threshold === 10));
assert(events.some(e => e.type === 'project-complete' && e.id === 'manuscript'));
assert(events.some(e => e.type === 'library' && e.ids.includes('torah')));

const html = text('index.html');
const app = text('app.js');
const css = text('styles.css');
const sw = text('sw.js');
const pkg = JSON.parse(text('package.json'));
assert.strictEqual(pkg.version, '2.10.4');
assert(html.includes('<script src="motion.js"></script>'));
assert(html.indexOf('motion.js') < html.indexOf('app.js'));
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['motion.js']), 'module must be included in the cached document');
assert(app.includes('const M = window.WTTNMotion'));
for (const token of [
  "M?.transition?.('translation'", "M?.transition?.('network'", "M?.transition?.('field-enter'",
  "M?.transition?.('field-complete'", "M?.transition?.('legacy'", "M?.transition?.('campaign'",
  'M?.reconcile?.(state, G)', 'M?.modalReveal?.(id)', 'M?.allocationChanged?.(channel)'
]) assert(app.includes(token), `missing motion integration ${token}`);
for (const token of [
  '.game-feel-layer', '.feel-purchased', '.feel-milestone-hit', '.feel-transition-campaign',
  '.feel-atlas-network', '.feel-atlas-field-complete', '@media (prefers-reduced-motion: reduce)'
]) assert(css.includes(token), `missing motion CSS ${token}`);
assert(!/transition\([^)]*innerHTML/i.test(text('motion.js')), 'motion transitions should not inject dynamic innerHTML');

console.log('Pristine Phase 6 motion/game feel: PASS · discrete feedback · reset transitions · atlas motion · reduced-motion contract · v2.10.4');
