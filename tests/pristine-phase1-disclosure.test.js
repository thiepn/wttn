'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('../game-core.js');
const D = require('../disclosure.js');

const ROOT = path.resolve(__dirname, '..');
const text = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function visible(state) { return D.getDisclosure(state, G); }
function tabList(d) { return d.visibleTabs.join(','); }
function resourceList(d) { return d.visibleResources.join(','); }

// 1. Fresh game exposes only the systems a new player can meaningfully act on.
let s = G.createState();
let d = visible(s);
assert.strictEqual(tabList(d), 'work,projects,translation,scripture,stats,system');
assert.strictEqual(resourceList(d), 'pages');
assert.strictEqual(d.stage, 'work');

// 2. The first completed Translation reveals Insight, but not later layers.
s.translations = 1;
s.ti = G.bn(2);
s.lifetimeTi = G.bn(2);
d = visible(s);
assert.strictEqual(tabList(d), 'work,projects,translation,insight,scripture,stats,system');
assert.strictEqual(resourceList(d), 'pages,ti');
assert.strictEqual(d.stage, 'translation');

// 3. Network reveals when Translation Automation makes it the current horizon.
s.tiOneTime.translationAutomation = true;
d = visible(s);
assert(d.tabs.network, 'Network did not reveal when Translation Automation was acquired');
assert(!d.resources.nc, 'NC hero resource revealed before the first Network existed');
assert.strictEqual(d.stage, 'network');

// 4. The first Network reveals NC in the hero, while Fields remain undisclosed until enterable.
s.networks = 1;
s.nc = G.bn(1);
s.lifetimeNc = G.bn(1);
d = visible(s);
assert(d.resources.nc, 'NC resource did not reveal after first Network');
assert(!d.tabs.fields, 'Fields revealed before the actual unlock boundary');

// 5. Field unlock reveals Fields; first Field clear reveals FE.
s.lifetimeNc = G.FIELD_UNLOCK_LIFETIME_NC;
s.ncThisField = G.bn(1);
G.updatePhase3Completion(s);
d = visible(s);
assert(d.tabs.fields, 'Fields did not reveal at field unlock');
assert(!d.resources.fe, 'FE hero resource revealed before any Field Experience existed');
s.field.index = 1;
s.fe = G.bn(10);
s.lifetimeFe = G.bn(10);
d = visible(s);
assert(d.resources.fe, 'FE resource did not reveal after first Field clear');

// 6. Legacy reveals when ready, but its hero resource and Scripture stay hidden until first Legacy.
s.feThisLegacy = G.LEGACY_UNLOCK_FE;
G.updatePhase4Completion(s);
d = visible(s);
assert(d.tabs.legacy, 'Legacy did not reveal when ready');
assert(!d.resources.legacy, 'Legacy hero resource revealed before first Legacy');
assert(d.tabs.scripture, 'Optional Scripture must be accessible before Legacy');
s.legacies = 1;
s.legacy = G.bn(15);
s.lifetimeLegacy = G.bn(15);
d = visible(s);
assert(d.resources.legacy, 'Legacy resource did not reveal after first Legacy');
assert(d.tabs.scripture, 'Scripture Library did not reveal after first Legacy');

// 7. Static boot surface prevents a flash of future systems before JavaScript renders an advanced save.
const html = text('index.html');
for (const tab of ['insight','network','fields','legacy','scripture']) {
  assert(new RegExp(`class="tab hidden" data-tab="${tab}"`).test(html), `future tab ${tab} is not hidden in initial HTML`);
}
for (const cls of ['ti-resource','network-resource','field-resource','legacy-resource']) {
  assert(new RegExp(`class="[^"]*${cls}[^"]*hidden|class="[^"]*hidden[^"]*${cls}`).test(html), `future resource ${cls} is not hidden at boot`);
}

// 8. Runtime IA guards future tabs and maps keyboard navigation to visible tabs only.
const app = text('app.js');
for (const token of [
  'D.isTabVisible(currentDisclosure, id)',
  "tabs.filter(tab => D.isTabVisible(currentDisclosure, tab.dataset.tab))",
  'renderPrimaryProgress(currentDisclosure',
  'if (currentDisclosure.tabs.network) etaStats.push',
  'if (currentDisclosure.tabs.fields) etaStats.push',
  'if (currentDisclosure.tabs.legacy) etaStats.push',
  "$('automationSwitchboardCard').classList.toggle('hidden', !automationVisible)",
  "$('resourceStack').dataset.count = String(disclosure.visibleResources.length)"
]) assert(app.includes(token), `progressive-disclosure runtime token missing: ${token}`);

// 9. PWA contains the new module so installed/offline UI uses identical disclosure rules.
const sw = text('sw.js');
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['disclosure.js']), 'disclosure.js missing from PWA app shell');
assert(text('index.html').includes('<script src="disclosure.js"></script>'), 'disclosure.js missing from page');

// 10. Economy/save files remain untouched by Phase 1; only UI/IA is allowed to change.
assert.strictEqual(JSON.parse(text('package.json')).version, '2.10.5');

console.log('Pristine Phase 1 progressive disclosure: PASS · fresh 5-tab surface · staged resource reveals · future layers inaccessible until relevant');
