const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8') + fs.readFileSync(path.join(root, 'interface.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.strictEqual(pkg.version, '2.10.1');
assert(app.includes("const APP_VERSION = '2.10.1'"));
assert(sw.includes("const BUILD='__BUILD_ID__'"));

// No explicit pixel font sizes below the 11px label floor.
const pxSizes = [...css.matchAll(/font-size\s*:\s*([0-9.]+)px/g)].map(m => Number(m[1]));
assert(pxSizes.length > 40, 'expected explicit typography rules');
assert.strictEqual(pxSizes.filter(n => n < 11).length, 0, 'micro-text below 11px remains');

// Required type-scale tokens and primary readability rules.
for (const needle of [
  '--text-body: 16px',
  '--text-secondary: 14px',
  '--text-meta: 13px',
  '--text-label: 11px',
  'font-size: 16px;',
  '.producer-card p, .allocation-card p, .field-card p, .scripture-card p, .specialization-card p',
  '.upgrade-card p, .project-card p, .insight-card p, .tradition-card p, .campaign-card p, .system-card p, .journal-intro'
]) assert(css.includes(needle), `missing typography contract: ${needle}`);

function hexToRgb(hex) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  return [0,2,4].map(i => parseInt(hex.slice(i,i+2),16)/255);
}
function luminance(hex) {
  return hexToRgb(hex).map(c => c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4))
    .reduce((v,c,i) => v + c * [0.2126,0.7152,0.0722][i], 0);
}
function contrast(a,b) {
  const [l1,l2] = [luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (l1+0.05)/(l2+0.05);
}
// Palette pairs shipped by the Atlas Chamber (normal text requires 4.5:1).
const pairs = [
 ['primary/chamber','#f2ebd9','#09151a'], ['muted/panel','#afbbb4','#13262c'],
 ['command/brass','#172226','#c6a564'], ['disabled/inset','#aab7b3','#1a2c31'],
 ['reading/parchment','#334444','#e8ddc3'], ['reading-label/parchment','#405347','#e8ddc3'],
 ['reference/chip','#2c403d','#d2c9ad'], ['warning/panel','#ef9690','#13262c']
];
for (const [name,fg,bg] of pairs) {
  assert(contrast(fg,bg) >= 4.5, `${name} contrast ${contrast(fg,bg).toFixed(2)} < 4.5`);
}

// Mobile typography must never deliberately shrink body content below 14px.
assert(css.includes('.hero-copy p:last-child { font-size:15px; line-height:1.68; }'));
assert(css.includes('.decision-copy > p:last-child { font-size:14px; }'));

console.log('Pristine Phase 3 typography/readability contract: PASS · typography tokens and Atlas Chamber palette pairs · v2.10.1 (not a full accessibility audit)');
