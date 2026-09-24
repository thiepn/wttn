'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const [major, minor] = pkg.version.split('.').map(Number);
assert(Number.isFinite(major) && Number.isFinite(minor) && (major >= 1 || (major === 0 && minor >= 7)), `Phase 7+ package expected, got ${pkg.version}`);
assert(html.includes('FROM THE WORD · TO EVERY NATION'), 'player-facing hero eyebrow missing');
assert(html.includes('Begin with a page. Build a work that can travel.'), 'new hero statement missing');
assert(!html.includes('UX &amp; AUTOMATION HARDENING'), 'development-phase text remains visible');
assert(app.includes('document.body.dataset.layer = visualLayer'), 'dynamic campaign-stage theming missing');
for (const token of ['--translation:', '--network:', '--field:', '--legacy:', '.producer-card::before', '.scripture-card::after', '.field-card::before']) {
  assert(css.includes(token), `visual contract token missing: ${token}`);
}
for (const tab of ['translation','network','fields','legacy','scripture']) {
  assert(html.includes(`data-tab="${tab}"`), `tab identity missing: ${tab}`);
}
console.log('Phase 7 visual contract: PASS');
