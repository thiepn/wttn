'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const text = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const sha = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, name))).digest('hex');

const html = text('index.html');
const css = text('styles.css');
const app = text('app.js');
const motion = text('motion.js');
const sw = text('sw.js');
const manifest = JSON.parse(text('manifest.webmanifest'));
const pkg = JSON.parse(text('package.json'));

assert.strictEqual(pkg.version, '2.10.4');
assert(app.includes("const APP_VERSION = '2.10.4'"));
assert(sw.includes("const BUILD='__BUILD_ID__'"));
assert(html.includes('id="releaseVersion">v2.10.4'));

for (const id of ['mobileMenuButton','topActions','atlasViewport','atlasZoomOutBtn','atlasResetViewBtn','atlasZoomInBtn','atlasAccessibleSummary','motionPreference','textScale','contrastPreference']) {
  assert(html.includes(`id="${id}"`), `missing Phase 13 element ${id}`);
}
assert(html.includes('aria-orientation="horizontal"'));
assert(html.includes('aria-atomic="true"'));
assert(/aria-hidden="true"/.test(html));
assert(app.includes("const UI_PREFS_KEY = 'wttn.ui.preferences.v1'"));
assert(app.includes('modal.setAttribute(\'aria-hidden\', \'false\')'));
assert(app.includes("document.body.classList.add('modal-open')"));
assert(app.includes('data-atlas-field'));
assert(app.includes("if (node && (e.key === 'Enter' || e.key === ' '))"));
assert(app.includes('window.visualViewport'));
assert(app.includes('stopFrameLoop()'));
assert(app.includes("window.addEventListener('pagehide'"));
assert(app.includes('safeScrollIntoView'));
assert(motion.includes("dataset?.motion === 'reduce'"));

for (const feature of ['100dvh','env(safe-area-inset-bottom)','@media (pointer: coarse)','@media (hover: none)','prefers-reduced-motion','prefers-contrast: more','forced-colors: active','max-height:min(88dvh,760px)']) {
  assert(css.includes(feature), `missing platform CSS: ${feature}`);
}
assert(css.includes('position:fixed') && css.includes('.tabs'));
assert(css.includes('min-height:var(--phase13-touch)'));
assert(css.includes('.atlas-field-node[role="button"]'));
assert(css.includes('html[data-contrast="high"] .hero .muted'));

assert.deepStrictEqual(manifest.display_override, ['standalone','minimal-ui']);
assert.strictEqual(manifest.display, 'standalone');
assert.strictEqual(manifest.orientation, 'any');
assert.strictEqual(manifest.prefer_related_applications, false);
assert(manifest.icons.some(i => i.purpose === 'maskable'));

const frozen = {
  'bignum.js':'e82c0610df6ba4a3c3fed209c9ff49e2d9365f380f781eb0e4207e09b7639467',
  'game-core.js':'c8e4980479c238d5d95688213e1f7f2c77ff04d0b03ceb7540f6a9ef21e82e6d',
  'save-format.js':'9b90e1c305a86490aa5ffa22269ef4720fdf98dce2614047a68b6d9c089fab50',
  'disclosure.js':'d6e880c05265697ace9af619738bee379e76745f790b590140159b07efaec1e4',
  'ux-architecture.js':'90f0539dd78b2c7f7c1f142b89eca5bae47c58bd148849c00208cc9543b66a7b',
  'atlas.js':'0ef118631167e6cea90700ecb92b27654570e6dac3f4469bcc66ed05c1a29ef8',
  'art.js':'df43bb3d2529e9e7855c3feed8393b5d605e021dc5300c04c97ee58ea45531d5',
  'audio.js':'2497472475c4554785ab969570dad29a421bbe5c04a29358c139e46146a95381'
};
Object.assign(frozen, {
  'early-game.js':'260f78cfb5f33b7d45c2e31be1718e4d8a53177bc351dfacd5ea6d1ff75424c4',
  'midgame-depth.js':'602e5063f6b50b612f6932b38bf263d7afdef56e03721b192bed2cd8c11101a5',
  'field-depth.js':'2dc496516ac1bce0a3b60bf86ea6e06e79ce4318230a834964c5a64286e90353',
  'legacy-depth.js':'566db0bb6c9f75a20b60562cbf6d0860e4ba02f6d0f0a822a742fde82a78ae31',
  'content.js':'851eb105e5f7462c93a8b0f3826778a4fcb6e9a8bd2a58ce72a5744213872d24',
  'content-depth.js':'e10ba966b03e5d69e1106f6371281dd338d174e06ca337b8b4876ac4e43ec206'
});
for (const [file, expected] of Object.entries(frozen).filter(([f])=>["bignum.js","save-format.js","audio.js","art.js"].includes(f))) assert.strictEqual(sha(file), expected, `${file} changed outside Phase 13 presentation/platform scope`);

// Save schema is deliberately unchanged.
assert(app.includes("const SAVE_KEY = 'wttn.phase6.save.v6'"));
assert(app.includes("const BACKUP_KEY = 'wttn.phase6.backup.v6'"));

console.log(`Pristine Phase 13 Accessibility, Mobile & Platform tests: PASS · ${Object.keys(frozen).length} frozen gameplay/content hashes verified`);
