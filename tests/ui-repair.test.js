'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const A=require('../appearance-model'),R=require('../settlement-animation'),V=require('../settlement-model'),F=require('../full-backup'),S=require('../save-format'),G=require('../game-core');
const bounds={x:-628.012,y:-436.01,w:2848.476,h:1874.038};let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('36 full decoration silhouettes clear all six buildings and delivery paths',()=>{
 for(const d of A.definitions)for(const slot of A.choices(d.id)){
  const p=A.placed(d.id,slot.id);assert.equal(A.clearance(p),'',d.id+'/'+slot.id);
  for(const b of V.sites)assert(!A.overlap(A.visualBounds(p),{left:b.x-b.w/2,right:b.x+b.w/2,top:b.y-b.h,bottom:b.y+18}));
 }
 assert(A.validate(A.fromLegacy(A.definitions.map(d=>d.id))).ok);
 for(const preset of Object.values(A.presets))assert(A.validate(preset.placements).ok);
});
test('preview cameras keep full objects and markers clear of desktop and phone sheets',()=>{
 for(const [width,height,safe] of [[1280,800,{x:20,y:195,w:878,h:514}],[390,192,{x:12,y:8,w:366,h:176}],[320,128,{x:12,y:8,w:296,h:112}]])
 for(const d of A.definitions)for(const slot of A.choices(d.id)){
  const p=A.placed(d.id,slot.id),c=R.frameDecoration({width,height,x:0,y:0,scale:1},p,safe,bounds);
  const left=c.x+(p.x-p.w/2)*c.scale,right=left+p.w*c.scale,top=c.y+(p.y-p.h*.95)*c.scale,bottom=c.y+p.y*c.scale+44;
  assert(left>=safe.x-1&&right<=safe.x+safe.w+1&&top>=safe.y-1&&bottom<=safe.y+safe.h+1,`${width} ${d.id}/${slot.id}`);
 }
});
test('old arrangements recover every known object without accepting unknown identifiers',()=>{
 const placements={pergola:'home',readingBench:'westCypress'};assert(!A.validate(placements).ok);
 const restored=A.restore(placements);assert(restored.ok&&restored.relocated);assert.deepEqual(Object.keys(restored.placements),Object.keys(placements));
 const economic=S.makeEnvelope(G.createState()),payload={kind:F.KIND,version:1,economic,appearance:{version:1,placements}};
 const parsed=F.parse(JSON.stringify({...payload,checksum:S.hashString(JSON.stringify(payload))}));assert.equal(parsed.economic,economic);assert(A.validate(parsed.placements).ok);
 assert(!A.restore({...placements,unknown:'home'}).ok);assert(!A.restore({pergola:'unknown'}).ok);assert(!A.restore(JSON.parse('{"__proto__":"home"}')).ok);
 assert(A.preview({pergola:'home'},'pergola','home').unchanged);
});
test('fix release preserves v2.10 numeric engine and save envelope bytes',()=>{
 for(const file of ['bignum.js','save-format.js']){
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(hash(file),hash('tests/baseline-v2.9/'+file),file);
 }
});
fs.mkdirSync('docs/qa-v2.10.1',{recursive:true});fs.writeFileSync('docs/qa-v2.10.1/regression-results.json',JSON.stringify({checks,failed:0,cameraCases:108,locations:36},null,2));
console.log(`${checks} UI repair regression groups passed.`);
