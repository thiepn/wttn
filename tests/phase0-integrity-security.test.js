'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('../game-core.js');
const S = require('../save-format.js');

const ROOT = path.resolve(__dirname, '..');
const text = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

// 1. Valid save round-trip remains lossless for canonical gameplay fields.
const state = G.createState();
state.pages = G.bn('1e42');
state.peakPages = G.bn('1e44');
state.ti = G.bn(1234);
state.lifetimeTi = G.bn(9999);
state.specialization = 'scholar';
state.tradition = 'distribution';
state.presets[0] = { slot: 1, name: 'Scholar long run', saved: true, specialization: 'scholar', auto: { enabled: true, minRun: 600, resetMultiple: 1.7, maxRun: 2400 } };
const envelope = S.makeEnvelope(state, 1234567890);
const roundTrip = S.parseSaveText(envelope).state;
assert(roundTrip.pages.eq(state.pages));
assert(roundTrip.peakPages.eq(state.peakPages));
assert(roundTrip.ti.eq(state.ti));
assert.strictEqual(roundTrip.specialization, 'scholar');
assert.strictEqual(roundTrip.tradition, 'distribution');
assert.strictEqual(roundTrip.presets[0].name, 'Scholar long run');

// 2. Imported strings cannot become markup/script and enums are whitelisted.
const hostile = G.createState();
hostile.specialization = '<img src=x onerror=alert(1)>';
hostile.queuedSpecialization = 'javascript:alert(1)';
hostile.tradition = '<svg onload=alert(1)>';
hostile.presets[0] = {
  slot: 999,
  name: '<img src=x onerror=alert(1)>',
  saved: true,
  specialization: '<b>scholar</b>',
  auto: { enabled: 'yes', minRun: -999, resetMultiple: 999, maxRun: 1 }
};
hostile.networkPresets[0] = {
  slot: 1,
  name: '<script>alert(1)</script>',
  saved: true,
  allocation: { local: 100, regional: -4, international: 'oops', digital: 1 }
};
hostile.records.recentTranslations = [{ duration: 10, gain: 4, specialization: '<img onerror=1>', automated: true }];
hostile.records.recentFields = [{
  id: 'urban', name: '<img src=x onerror=alert(1)>', tier: 999, duration: 10, gain: 2,
  validNetworks: 1, translations: 1, projects: ['manuscript', '<script>'], allocations: []
}];
hostile.evilTopLevel = '<img onerror=alert(1)>';
hostile.version = G.VERSION;
const revived = S.parseSaveText(JSON.stringify(hostile)).state;
assert.strictEqual(revived.specialization, null);
assert.strictEqual(revived.queuedSpecialization, null);
assert.strictEqual(revived.tradition, null);
assert(!/[<>]/.test(revived.presets[0].name), 'preset name still contains markup delimiters');
assert(!/[<>]/.test(revived.networkPresets[0].name), 'network preset name still contains markup delimiters');
assert.strictEqual(revived.presets[0].specialization, null);
assert.strictEqual(revived.records.recentTranslations[0].specialization, null);
assert.strictEqual(revived.records.recentFields[0].name, 'Urban Hub I');
assert.deepStrictEqual(revived.records.recentFields[0].projects, ['manuscript']);
assert.strictEqual(Object.prototype.hasOwnProperty.call(revived, 'evilTopLevel'), false, 'unknown top-level import field survived revival');
assert.strictEqual(revived.presets[0].slot, 1);
assert(revived.presets[0].auto.minRun >= 1 && revived.presets[0].auto.minRun <= 7200);
assert(revived.presets[0].auto.resetMultiple <= 10);

// 3. Unsupported/future versions are rejected rather than guessed at.
const future = G.createState();
future.version = G.VERSION + 1;
assert.throws(() => S.parseSaveText(JSON.stringify(future)), /newer|unsupported/i);

// 4. Oversized, malformed, and tampered payloads are rejected.
assert.throws(() => S.parseSaveText(' '.repeat(S.MAX_SAVE_TEXT_CHARS + 1)), /2 MB|exceeds/i);
assert.throws(() => S.parseSaveText('{not json'), /valid JSON/i);
const tampered = JSON.parse(envelope);
tampered.state.pages = '1e999';
assert.throws(() => S.parseSaveText(JSON.stringify(tampered)), /checksum mismatch/i);
const badChecksum = JSON.parse(envelope);
badChecksum.checksum = '<not-a-checksum>';
assert.throws(() => S.parseSaveText(JSON.stringify(badChecksum)), /checksum.*malformed/i);

// 5. UI keeps a second rendering-boundary defense and file-size gate.
const app = text('app.js');
assert(app.includes('const MAX_IMPORT_BYTES = 2 * 1024 * 1024'));
assert(app.includes('const escapeHtml ='));
assert(app.includes('file.size > MAX_IMPORT_BYTES'));
assert(app.includes('escapeHtml(p.name)'));
assert(app.includes('escapeHtml(run.name || run.id)'));
assert(app.includes('escapeHtml(run.specialization)'));

// 6. Modal accessibility/integrity manager is centralized and complete.
for (const token of [
  'function openModal(', 'function closeModal(', 'function trapModalTab(',
  "child.inert = true", "setAttribute('aria-hidden', 'true')",
  "closeModalToTab('completionModal', 'insight')",
  "closeModal(open.id)"
]) assert(app.includes(token), `missing modal hardening token: ${token}`);

// No player-flow code should directly show these dialogs anymore.
for (const id of ['completionModal','masteryModal','phase3Modal','phase4Modal','phase5Modal','offlineModal']) {
  const direct = new RegExp(`\\$\\('${id}'\\)\\.classList\\.remove\\('hidden'\\)`);
  assert(!direct.test(app), `dialog bypasses modal manager: ${id}`);
}

// 7. Release version is coherent across shipping surfaces.
const pkg = JSON.parse(text('package.json'));
assert.strictEqual(pkg.version, '2.10.4');
assert(app.includes("const APP_VERSION = '2.10.4'"));
assert(text('sw.js').includes("const BUILD='__BUILD_ID__'"));
assert(text('index.html').includes('id="releaseVersion">v2.10.4'));
assert(text('README.md').includes('# Word to the Nations — v2.10.4'));
assert(!text('index.html').includes('phase2-hero'), 'development-era hero class remains');

console.log('Pristine Phase 0 integrity/security: PASS · malicious imports sanitized · future/oversized saves rejected · modal focus contract enforced · v2.10.4 coherent');
