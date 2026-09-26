'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const text = p => fs.readFileSync(path.join(ROOT,p),'utf8');
const A = require('../audio.js');

assert.strictEqual(A.version, '1.7.0');
assert.strictEqual(A.storageKey, 'wttn.audio.v1');
assert.strictEqual(A.defaults.enabled, false, 'sound must default off');
assert.strictEqual(A.defaults.ambientEnabled, false, 'ambient must default off');
assert.deepStrictEqual(A.normalizeSettings({ enabled:true, master:2, ui:-1, milestones:.75, ambient:'0.3', ambientEnabled:true }), {
  enabled:true, master:1, ui:0, milestones:.75, ambient:.3, ambientEnabled:true
});
for (const cue of ['purchase','method','project','translation','network','fieldEnter','fieldComplete','legacy','library','campaign']) assert(A.cues[cue], `missing cue ${cue}`);

const fakeG = { SCRIPTURE_COLLECTIONS:[{id:'torah'},{id:'acts'}] };
const base = { phase2Complete:false,phase3Complete:false,phase4Complete:false,campaign:{complete:false},library:{torah:false,acts:false} };
const advanced = { phase2Complete:true,phase3Complete:true,phase4Complete:true,campaign:{complete:false},library:{torah:true,acts:false} };
const final = { phase2Complete:true,phase3Complete:true,phase4Complete:true,campaign:{complete:true},library:{torah:true,acts:true} };
const initial = A.snapshot(base,fakeG), next=A.snapshot(advanced,fakeG), done=A.snapshot(final,fakeG);
const events=A.diffSnapshots(initial,next);
assert(events.some(e=>e.type==='unlock'&&e.system==='network'));
assert(events.some(e=>e.type==='unlock'&&e.system==='fields'));
assert(events.some(e=>e.type==='unlock'&&e.system==='legacy'));
assert(events.some(e=>e.type==='library'&&e.id==='torah'));
const finalEvents=A.diffSnapshots(next,done);
assert(finalEvents.some(e=>e.type==='library'&&e.id==='acts'));
assert(finalEvents.some(e=>e.type==='campaign'));
// Seeding a restored advanced state must establish a baseline rather than replaying prior unlocks.
A.seed(advanced,fakeG);
assert.deepStrictEqual(A.reconcile(advanced,fakeG), []);

const html=text('index.html'), app=text('app.js'), css=text('styles.css'), sw=text('sw.js');
const pkg=JSON.parse(text('package.json'));
assert.strictEqual(pkg.version,'2.11.0');
assert(html.includes('<script src="audio.js"></script>'));
assert(html.indexOf('audio.js') < html.indexOf('app.js'));
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['audio.js']), 'module must be included in the cached document');
assert(app.includes('const Q = window.WTTNAudio'));
assert(app.includes('Q?.init?.()'));
assert(app.includes('Q?.seed?.(state, G)'));
assert(app.includes('Q?.reconcile?.(state, G)'));
for (const token of ["Q?.play?.('translation'", "Q?.play?.('network'", "Q?.play?.('fieldEnter'", "Q?.play?.('fieldComplete'", "Q?.play?.('legacy'", "Q?.play?.('campaign'"]) assert(app.includes(token), `missing audio integration ${token}`);
for (const id of ['audioEnabled','audioMaster','audioUi','audioMilestones','audioAmbient','audioAmbientEnabled','audioTestUi','audioTestMilestone','audioStatus']) assert(html.includes(`id="${id}"`), `missing audio control ${id}`);
for (const token of ['.audio-settings-card','.audio-mixer','.audio-level','.audio-status']) assert(css.includes(token), `missing audio CSS ${token}`);
assert(!/\.mp3|\.wav|\.ogg/i.test(html+app+text('audio.js')), 'procedural audio release should not depend on bundled audio files');
assert(text('audio.js').includes('AudioContext') || text('audio.js').includes('webkitAudioContext'));
console.log('Pristine Phase 7 sound/audio identity: PASS · sound-off default · procedural Web Audio · persistent mixer · event cues · no replay on restore · v2.11.0');
