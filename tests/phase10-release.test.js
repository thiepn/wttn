'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p));
const text = p => read(p).toString('utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));
const sha256 = p => crypto.createHash('sha256').update(read(p)).digest('hex');

// v1.0.1 intentionally changes game-core/save-format sanitization only; full progression tests pin economy behavior.

const pkg = JSON.parse(text('package.json'));
assert.strictEqual(pkg.version, '2.10.6');

const manifest = JSON.parse(text('manifest.webmanifest'));
assert.strictEqual(manifest.name, 'Word to the Nations');
assert.strictEqual(manifest.display, 'standalone');
assert.strictEqual(manifest.start_url, './');
assert.strictEqual(manifest.scope, './');
assert.strictEqual(manifest.theme_color, '#193d38');
assert(manifest.icons.some(i => i.sizes === '192x192'));
assert(manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'any'));
assert(manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));

function pngSize(file) {
  const b = read(file);
  assert.strictEqual(b.toString('ascii', 1, 4), 'PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
assert.deepStrictEqual(pngSize('icons/icon-32.png'), [32,32]);
assert.deepStrictEqual(pngSize('icons/icon-180.png'), [180,180]);
assert.deepStrictEqual(pngSize('icons/icon-192.png'), [192,192]);
assert.deepStrictEqual(pngSize('icons/icon-512.png'), [512,512]);
assert.deepStrictEqual(pngSize('icons/icon-maskable-512.png'), [512,512]);

const html = text('index.html');
for (const required of [
  'rel="manifest" href="manifest.webmanifest"',
  'icons/icon-180.png',
  'id="installAppBtn"',
  'id="updateAppBtn"',
  'id="installTopBtn"',
  'id="appInstallStatus"',
  'id="releaseVersion"'
]) assert(html.includes(required), `index missing ${required}`);

const app = text('app.js');
assert(app.includes("const APP_VERSION = '2.10.6'"));
assert(app.includes("navigator.serviceWorker.register('./sw.js'"));
assert(app.includes("window.addEventListener('beforeinstallprompt'"));
assert(app.includes("swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })"));

const sw = text('sw.js');
assert(sw.includes("const BUILD='__BUILD_ID__'"));
assert(sw.includes("const CORE=PREFIX+BUILD"));
assert(sw.includes("self.registration.scope"));
assert(sw.includes("event.data?.type==='SKIP_WAITING'"));
assert(sw.includes("request.mode==='navigate'"));
const built=text('dist/web/sw.js');
const shell=JSON.parse(built.match(/const ESSENTIAL=(\[[^;]*?\]), ASSETS=/)[1]);
const buildManifest=JSON.parse(text('dist/build-manifest.json'));
for(const asset of shell){if(asset==='./')continue;assert(exists('dist/web/'+asset.replace(/^\.\//,'')),`Missing cached asset ${asset}`);}
for(const mustCache of ['icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'])assert(shell.includes('./'+buildManifest.assets[mustCache]));
assert(shell.includes('./index.html')&&shell.includes('./manifest.webmanifest'));


for (const module of ['settlement.css','bignum.js','game-core.js','save-format.js','content.js','disclosure.js','atlas.js','art.js','motion.js','audio.js','app.js']) assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(buildManifest.assets[module]), `cached index must reference ${module}`);

assert(exists('.nojekyll'), '.nojekyll missing');
assert(!exists('game-core.phase9-variant.js'), 'temporary Phase 9 variant leaked into release');
assert(!fs.readdirSync(ROOT).some(name => /phase9.*(?:tmp|variant)/i.test(name)), 'temporary Phase 9 balance artifact leaked into release root');

console.log('Phase 10/PWA release contract: PASS · v2.10.6 · bundled PWA source contract and gameplay checks');
