const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const root = path.resolve(__dirname, '..');

function loadContent() {
  const code = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  const ctx = { globalThis: {} };
  ctx.globalThis.globalThis = ctx.globalThis;
  vm.runInNewContext(code, ctx, { filename: 'content.js' });
  return ctx.globalThis.WTTNContent;
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const C = loadContent();
const G = require(path.join(root, 'game-core.js'));
assert(C && C.CONTENT_VERSION === '2.2.0', 'Current content module v2.2.0 must load.');

const coverage = [
  ['PRODUCERS', G.PRODUCERS],
  ['METHODS', G.PAGE_UPGRADES],
  ['PROJECTS', G.PROJECTS],
];
for (const [group, defs] of coverage) {
  for (const d of defs) assert(C[group]?.[d.id], `Missing content for ${group}.${d.id}`);
}
for (const d of G.TI_REPEATABLES) assert(C.TRANSLATION?.repeatables?.[d.id], `Missing repeatable content: ${d.id}`);
for (const d of G.TI_ONE_TIMES) assert(C.TRANSLATION?.oneTimes?.[d.id], `Missing one-time content: ${d.id}`);
for (const d of G.SPECIALIZATIONS) assert(C.TRANSLATION?.specializations?.[d.id], `Missing specialization content: ${d.id}`);
for (const d of G.NETWORK_UPGRADES) assert(C.NETWORK?.upgrades?.[d.id], `Missing Network content: ${d.id}`);
for (const d of G.DISTRIBUTION_CHANNELS) assert(C.NETWORK?.channels?.[d.id], `Missing distribution content: ${d.id}`);
for (const d of [...G.FIELDS, G.MATURE_FIELD]) assert(C.FIELDS?.[d.id], `Missing Field content: ${d.id}`);
for (const d of G.TRADITIONS) assert(C.LEGACY?.traditions?.[d.id], `Missing Tradition content: ${d.id}`);
for (const d of G.LEGACY_MILESTONES) assert(C.LEGACY?.milestones?.[d.id], `Missing Legacy milestone content: ${d.id}`);
for (const d of G.SCRIPTURE_COLLECTIONS) assert(C.LIBRARY?.[d.id], `Missing Scripture Library content: ${d.id}`);

assert((C.ACHIEVEMENTS || []).length === 10, 'Milestone Journal must contain 10 non-mechanical milestones.');
assert(Object.keys(C.TERMINOLOGY || {}).length === 5, 'Resource terminology must cover all five core resources.');

const referencePattern = /^(?:[1-3] )?[A-Za-z]+(?: [A-Za-z]+)* \d+:\d+(?:[–-]\d+)?$/;
function collectRefs(x, out = []) {
  if (!x || typeof x !== 'object') return out;
  if (Array.isArray(x)) { for (const v of x) collectRefs(v, out); return out; }
  for (const [k, v] of Object.entries(x)) {
    if (k === 'references' && Array.isArray(v)) out.push(...v);
    else if (k === 'reference' && typeof v === 'string') out.push(v);
    else collectRefs(v, out);
  }
  return out;
}
const refs = collectRefs(C);
assert(refs.length >= 80, `Expected a substantial Scripture-reference layer; found ${refs.length}.`);
for (const r of refs) assert(referencePattern.test(r), `Malformed Scripture reference: ${r}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert(index.includes('<script src="content.js"></script>'), 'content.js must load before app.js.');
assert(index.includes('id="terminologyGrid"'), 'Terminology/guardrail UI missing.');
assert(index.includes('id="achievementGrid"'), 'Milestone Journal UI missing.');
assert(index.includes('Scripture is never a currency'), 'Scripture anti-commodification statement missing.');
assert(app.includes('achievementUnlocked'), 'Milestone Journal rendering logic missing.');

// Explicitly reject mechanics that would commodify sacred outcomes.
const mechanicsText = fs.readFileSync(path.join(root, 'game-core.js'), 'utf8').toLowerCase();
const forbiddenMechanics = ['souls per second', 'souls/sec', 'faith points', 'prayer points', 'conversion points', 'converts per second', 'holiness points'];
for (const phrase of forbiddenMechanics) assert(!mechanicsText.includes(phrase), `Forbidden sacred-outcome mechanic found: ${phrase}`);

// Phase 8 itself was content-only. Later certified phases may intentionally
// modify mechanics, so the byte-identity check only applies to the 0.8 package.
if (pkg.version === '0.8.0') {
  const phase7 = '/mnt/data/word-to-the-nations-phase7-visual-design';
  for (const f of ['bignum.js', 'game-core.js', 'save-format.js']) {
    assert(sha(path.join(root, f)) === sha(path.join(phase7, f)), `${f} changed during content-only Phase 8.`);
  }
}

console.log(`Phase 8 content contract: PASS · ${refs.length} Scripture references · 10 journal milestones · mechanics frozen`);
