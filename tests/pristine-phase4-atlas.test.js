'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const text = file => fs.readFileSync(path.join(root, file), 'utf8');

global.WTTNBig = require('../bignum.js');
const G = require('../game-core.js');
const A = require('../atlas.js');

function model(state) { return A.getAtlasModel(state, G); }

let s = G.createState();
let m = model(s);
assert.strictEqual(m.stage, 'work');
assert.strictEqual(m.showTranslation, false);
assert.strictEqual(m.action.tab, 'translation');
assert.strictEqual(m.fields.length, 9);

s.translations = 1;
s.ti = G.bn(2);
s.lifetimeTi = G.bn(2);
m = model(s);
assert.strictEqual(m.stage, 'translation');
assert.strictEqual(m.showTranslation, true);
assert.strictEqual(m.showNetwork, false);
assert.strictEqual(m.action.tab, 'insight');

s.tiOneTime.translationAutomation = true;
m = model(s);
assert.strictEqual(m.stage, 'network');
assert.strictEqual(m.showNetwork, true);
assert.strictEqual(m.networks, 0);

s.networks = 3;
s.nc = G.bn(2);
s.lifetimeNc = G.bn(5);
s.allocation = { local:.1, regional:.2, international:.5, digital:.2 };
m = model(s);
assert(Math.abs(m.allocation.international - .5) < 1e-9);
assert.strictEqual(m.networks, 3);
const sigNetwork = A.signature(m);
s.allocation.international = .4; s.allocation.local = .2;
assert.notStrictEqual(A.signature(model(s)), sigNetwork, 'allocation changes should redraw the atlas');

s.phase3Complete = true;
s.field.index = 2;
s.field.active = true;
m = model(s);
assert.strictEqual(m.stage, 'field');
assert.strictEqual(m.fields[0].status, 'complete');
assert.strictEqual(m.fields[1].status, 'complete');
assert.strictEqual(m.fields[2].status, 'active');
assert.strictEqual(m.fields[3].status, 'locked');
assert(/fictional campaign contexts/i.test(m.narrative));

s.phase4Complete = true;
s.legacies = 2;
s.legacy = G.bn(20);
s.lifetimeLegacy = G.bn(35);
m = model(s);
assert.strictEqual(m.stage, 'legacy');
assert.strictEqual(m.showLegacy, true);
assert.strictEqual(m.legacies, 2);

s.field.index = G.FIELDS.length;
s.field.active = false;
s.field.matureClears = 4;
m = model(s);
assert.strictEqual(m.matureClears, 4);
assert.strictEqual(m.canonicalCleared, 9);

s.campaign.complete = true;
m = model(s);
assert.strictEqual(m.stage, 'complete');
assert.strictEqual(m.complete, true);
assert.strictEqual(m.action.tab, 'scripture');
assert(/does not claim/i.test(m.narrative));

const html = text('index.html');
const css = text('styles.css');
const app = text('app.js');
const sw = text('sw.js');
for (const id of ['missionAtlas','atlasEyebrow','atlasTitle','atlasNarrative','atlasLegend','atlasActionBtn','atlasSvg']) {
  assert(html.includes(`id="${id}"`), `missing atlas element ${id}`);
}
assert(html.includes('<script src="atlas.js"></script>'));
assert(app.includes('const A = window.WTTNAtlas'));
assert(app.includes('function renderAtlas()'));
assert(app.includes('renderAtlas();'));
assert(css.includes('.mission-atlas'));
assert(css.includes('.atlas-field-node.is-active'));
assert(css.includes('@media (prefers-reduced-motion: reduce)'));
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['atlas.js']), 'atlas.js missing from PWA app shell');

console.log('Pristine Phase 4 Living Mission Atlas: PASS · state-driven page→Translation→Network→Field→Legacy→campaign visualization verified');
