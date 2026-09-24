const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
const seen = new Set();
const duplicates = ids.filter(id => seen.has(id) ? true : (seen.add(id), false));
assert.deepStrictEqual(duplicates, [], `Duplicate IDs: ${duplicates.join(', ')}`);

const refs = [...app.matchAll(/\$\(["']([^"']+)["']\)/g)].map(m => m[1]);
const missing = [...new Set(refs.filter(id => !seen.has(id)))];
assert.deepStrictEqual(missing, [], `Missing DOM IDs: ${missing.join(', ')}`);

for (const file of ['bignum.js','game-core.js','save-format.js','motion.js','audio.js','app.js','styles.css']) {
  assert(fs.existsSync(path.join(root, file)), `Missing asset: ${file}`);
}
assert(html.indexOf('game-core.js') < html.indexOf('save-format.js'));
assert(html.indexOf('save-format.js') < html.indexOf('app.js'));
assert(/class=["']skip-link["']/.test(html), 'Missing skip link');
assert(/<main[^>]*id=["']mainContent["']/.test(html), 'Missing main landmark');
assert(/role=["']tablist["']/.test(html), 'Missing tablist semantics');
assert(/prefers-reduced-motion/.test(css), 'Missing reduced-motion support');
assert(/:focus-visible/.test(css), 'Missing focus-visible treatment');

console.log(`Phase 6 static audit: PASS · ${ids.length} IDs · ${refs.length} DOM references · 0 missing · 0 duplicates`);
