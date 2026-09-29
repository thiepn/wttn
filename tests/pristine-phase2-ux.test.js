'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const text = f => fs.readFileSync(path.join(root,f),'utf8');

global.WTTNBig = require('../bignum.js');
const G = require('../game-core.js');
const D = require('../disclosure.js');
const U = require('../ux-architecture.js');

const html = text('index.html');
const css = text('styles.css');
const app = text('app.js');
const sw = text('sw.js');
const pkg = JSON.parse(text('package.json'));

assert.strictEqual(pkg.version, '2.10.6');
assert(app.includes("const APP_VERSION = '2.10.6'"));
assert(sw.includes("const BUILD='__BUILD_ID__'"));
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['ux-architecture.js']), 'module must be included in the cached document');
assert(html.includes('<script src="ux-architecture.js"></script>'));

for (const id of ['workDecisionCockpit','projectsDecisionCockpit','translationDecisionCockpit','insightDecisionCockpit','networkDecisionCockpit','fieldsDecisionCockpit','legacyDecisionCockpit']) {
  assert(html.includes(`id="${id}"`), `missing decision cockpit ${id}`);
}
for (const id of ['producerWorkspace','methodsWorkspace','translationResetWorkspace','practiceWorkspace','developmentWorkspace','automationWorkspace','networkResetWorkspace','distributionWorkspace','fieldChallengeWorkspace','fieldMapWorkspace','legacyResetWorkspace','campaignWorkspace']) {
  assert(html.includes(`id="${id}"`), `missing workspace ${id}`);
}
assert(css.includes('.decision-cockpit'));
assert(css.includes('.section-jump-nav'));
assert(css.includes('.ux-recommended'));
assert(app.includes('renderDecisionCockpits()'));
assert(app.includes('[data-section-target]'));

const fresh = G.createState();
let ux = U.getAll(fresh,G);
assert(ux.work.question.length > 10);
assert.strictEqual(ux.translation.metrics[0][0], 'Gain now');
assert.strictEqual(D.getDisclosure(fresh,G).visibleTabs.includes('network'), false);

fresh.pages = G.bn(1000); fresh.peakPages = G.bn(1000);
ux = U.getAll(fresh,G);
assert(ux.work.recommended?.type === 'upgrade' || ux.work.recommended?.type === 'producer');

const translated = G.createState();
translated.translations = 1;
translated.lifetimeTi = G.bn(120);
translated.ti = G.bn(120);
ux = U.getAll(translated,G);
assert(ux.insight.question.length > 10);
assert(Array.isArray(ux.insight.metrics) && ux.insight.metrics.length === 3);

const networked = G.createState();
networked.translations = 20;
networked.lifetimeTi = G.bn(5000);
networked.tiThisNetwork = G.bn(5000);
networked.networks = 1;
networked.nc = G.bn(10);
networked.lifetimeNc = G.bn(10);
ux = U.getAll(networked,G);
assert(ux.network.question.length > 10);

// The cockpit shares the depth model's opportunity-cost decision instead of recommending a purchase one TI before a permanent unlock.
{
  const s = G.createState(); s.translations = 5; s.lifetimeTi = G.bn(1000); s.ti = G.bn(24); s.specialization = 'publisher';
  for (const id of ['standardTerminology','reusableTemplates','consistentWorkflow']) s.tiOneTime[id] = true;
  s.tiUpgrades = { workflow: 2, training: 1, preparation: 0 };
  const model = U.getAll(s,G).insight;
  assert.match(model.question, /Save for Basic Automation/);
  assert(!model.recommended, 'saving guidance must not simultaneously highlight a repeatable purchase');
}

// Network guidance evaluates all available development instead of blindly choosing the first array entry.
{
  const s = G.createState(); s.networks = 1; s.lifetimeNc = G.bn(1); s.nc = G.bn(8);
  let model = U.getAll(s,G).network;
  assert.strictEqual(model.recommended?.id, 'distributionNotes');
  s.netOneTime.distributionNotes = true;
  model = U.getAll(s,G).network;
  assert.strictEqual(model.recommended?.id, 'localPartnership');
}

// Utility-only Reference System is never presented as the best economic purchase.
{
  const s = G.createState(); s.pages = G.bn('1e9'); s.peakPages = s.pages.clone();
  for (const id of ['desk','copying','editorial','teaching','workshopCoord']) s.pageUpgrades[id] = 1;
  s.projects = { manuscript:true, reference:true, teaching:true };
  const model = U.getAll(s,G).work;
  assert(!(model.recommended?.type === 'upgrade' && model.recommended?.id === 'reference'));
}

assert(app.includes('Unlocked · Paused'), 'automation cards must distinguish unlocked/paused from active');

console.log('Pristine Phase 2 UX architecture: PASS · decision cockpits + workspaces + contextual recommendations verified');
