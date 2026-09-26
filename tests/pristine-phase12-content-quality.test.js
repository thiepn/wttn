'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const text = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const ctx = { globalThis: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(text('content.js'), ctx);
vm.runInContext(text('content-depth.js'), ctx);
const C = ctx.WTTNContent;
const K = ctx.WTTNContentDepth;

assert.strictEqual(JSON.parse(text('package.json')).version, '2.10.6');
assert(text('app.js').includes("const APP_VERSION = '2.10.6'"));
assert(text('sw.js').includes("const BUILD='__BUILD_ID__'"));
assert(text('index.html').includes('id="releaseVersion">v2.10.6'));
assert(text('README.md').includes('# Word to the Nations — v2.10.6'));
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['content-depth.js']), 'module must be included in cached document');
assert(text('index.html').includes('<script src="content-depth.js"></script>'));

assert.strictEqual(C.CONTENT_VERSION, '2.2.0');
assert.strictEqual(K.VERSION, '2.2.0');
assert.strictEqual(K.HISTORICAL_NOTES.length, 6);
assert.strictEqual(Object.keys(K.LIBRARY_DETAILS).length, 8);
assert.strictEqual(Object.keys(K.FIELD_DETAILS).length, 10);
assert.strictEqual(Object.keys(K.JOURNAL_DETAILS).length, 10);
assert.strictEqual(K.GUARDRAILS.length, 8);
assert(K.REVIEW.principles.length >= 6);

const libraryIds = ['torah','history','wisdom','prophets','gospels','acts','epistles','revelation'];
for (const id of libraryIds) {
  const d = K.LIBRARY_DETAILS[id];
  assert(d, `missing library detail ${id}`);
  assert(d.lens && d.reflection && d.gameBoundary, `incomplete library detail ${id}`);
  assert(Array.isArray(d.questions) && d.questions.length >= 2, `questions ${id}`);
  assert(Array.isArray(d.readingPath) && d.readingPath.length >= 3, `reading path ${id}`);
}

const fieldIds = ['urban','remote','oral','restricted','multilingual','urban-ii','remote-ii','multilingual-ii','frontier-iii','mature-field'];
for (const id of fieldIds) {
  const d = K.FIELD_DETAILS[id];
  assert(d, `missing field detail ${id}`);
  assert(d.focus && d.abstraction && d.reflection, `incomplete field detail ${id}`);
}

for (const [id, d] of Object.entries(K.JOURNAL_DETAILS)) {
  assert(d.category && d.memory && d.reflection, `incomplete journal ${id}`);
}

for (const note of K.HISTORICAL_NOTES) {
  assert(note.type === 'history');
  assert(note.title && note.body && note.era);
  assert(Array.isArray(note.sourceIds) && note.sourceIds.length >= 1);
  for (const sourceId of note.sourceIds) {
    const src = K.SOURCES[sourceId];
    assert(src, `unknown source ${sourceId}`);
    assert(/^https:\/\//.test(src.url), `source must be https ${sourceId}`);
    assert(src.publisher && src.label);
  }
}

const html = text('index.html');
const app = text('app.js');
const css = text('styles.css');
assert(html.includes('id="historyContextGrid"'));
assert(html.includes('id="guardrailGrid"'));
assert(app.includes('sourceLinksHtml'));
assert(app.includes('library-deep-dive'));
assert(app.includes('field-context-detail'));
assert(app.includes('journal-reflection'));
assert(css.includes('.history-context-grid'));
assert(css.includes('.guardrail-grid'));

const allContent = [text('content.js'), text('content-depth.js'), html].join('\n').toLowerCase();
for (const forbidden of ['souls/sec','prayer points','conversion multiplier','convert people for']) {
  assert(!allContent.includes(forbidden), `forbidden framing found: ${forbidden}`);
}
for (const required of ['access is not engagement','people are never output','mission belongs to god']) {
  assert(allContent.includes(required), `missing guardrail: ${required}`);
}

console.log('Pristine Phase 12 Content Expansion & Christian Quality tests: PASS');
