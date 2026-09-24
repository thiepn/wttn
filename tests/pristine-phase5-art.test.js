'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const text = p => fs.readFileSync(path.join(ROOT,p),'utf8');
const Art = require('../art.js');

const producers = ['scribe','copyist','editor','teacher','workshop','scriptorium'];
const methods = ['desk','copying','editorial','teaching','workshopCoord','reference','shared','translationPrep'];
const projects = ['manuscript','reference','teaching'];
const specs = ['scholar','publisher','teacher'];
const channels = ['local','regional','international','digital'];
const fields = ['urban','remote','oral','restricted','multilingual','urban-ii','remote-ii','multilingual-ii','frontier-iii','mature-field'];
const traditions = ['translation','teaching','distribution','pioneer'];
const library = ['torah','history','wisdom','prophets','gospels','acts','epistles','revelation'];

function assertSvg(fn, ids, label) {
  for (const id of ids) {
    const out = fn(id);
    assert(out.includes('<svg'), `${label} ${id} missing svg`);
    assert(out.includes('viewBox="0 0 96 96"'), `${label} ${id} missing canonical viewBox`);
    assert(!/<script|onerror=|onload=/i.test(out), `${label} ${id} contains executable markup`);
  }
}
assertSvg(Art.producer, producers, 'producer');
assertSvg(Art.method, methods, 'method');
assertSvg(Art.project, projects, 'project');
assertSvg(Art.specialization, specs, 'specialization');
assertSvg(Art.channel, channels, 'channel');
assertSvg(Art.field, fields, 'field');
assertSvg(Art.tradition, traditions, 'tradition');
assertSvg(Art.library, library, 'library');
for (const id of fields.slice(0,9)) assert(Art.fieldSymbol(id).includes('atlas-art-glyph'), `field ${id} missing atlas glyph`);
assert(Art.seal('50').includes('wttn-seal'));

const app = text('app.js')+text('secondary-screens.js');
for (const token of ['R?.producer?.','R?.method?.','data-commission=','R?.specialization?.','R?.channel?.','R?.field?.','R?.fieldSymbol?.','R?.tradition?.','R?.library?.','R?.seal?.']) {
  assert(app.includes(token), `app missing art integration: ${token}`);
}
const html = text('index.html');
assert(html.includes('<script src="art.js"></script>'), 'art.js not loaded');
const sw = text('sw.js');
assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['art.js']), 'art.js not cached by service worker');
const css = text('styles.css');
for (const token of ['card-art-producer','field-emblem','library-crest','atlas-art-glyph','tradition-art']) assert(css.includes(token), `missing art CSS ${token}`);

console.log(`Pristine Phase 5 art direction: PASS · ${producers.length} producers · ${fields.length} Field marks · ${library.length} Library crests · shared atlas emblems`);
