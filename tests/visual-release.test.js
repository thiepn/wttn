'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Loader=require('../asset-loader');
let passed=0;
async function test(name,run){await run();passed++;console.log('PASS '+name);}
(async()=>{
 await test('Settlement and Journey share one decoded pool and one download limit',async()=>{
  let requests=0,live=0,peak=0;
  const manifest=Object.fromEntries(Array.from({length:8},(_,i)=>['image'+i,{src:'asset'+i}]));
  function imageFactory(){const img={naturalWidth:100,naturalHeight:100};Object.defineProperty(img,'src',{set(){requests++;live++;peak=Math.max(peak,live);setImmediate(()=>{live--;img.onload();});}});return img;}
  const a=Loader.shared(manifest,{imageFactory,maxBytes:160000,concurrency:99}),b=Loader.shared(manifest);
  assert.equal(a,b);await Promise.all(Object.keys(manifest).map(k=>a.load(k)));assert.equal(requests,8);assert(peak<=3);assert(a.stats().decodedBytes<=160000);
 });
 await test('oversized optional images preserve the resident fallback and are not retried',async()=>{
  const urls=[];function imageFactory(){const img={naturalWidth:100,naturalHeight:100};Object.defineProperty(img,'src',{set(url){urls.push(url);if(url==='huge'){img.naturalWidth=10000;img.naturalHeight=10000;}queueMicrotask(()=>img.onload());}});return img;}
  const l=Loader.create({scene:{variants:{low:'small',high:'huge'}}},{imageFactory,maxBytes:100000});await l.load('scene');const old=l.get('scene');await l.load('scene','high');await l.load('scene','high');assert.equal(l.get('scene'),old);assert.equal(urls.filter(x=>x==='huge').length,1);assert(l.stats().decodedBytes<=100000);
 });
 await test('resize can shrink residency below a formerly protected landscape image',async()=>{
  function imageFactory(){const img={naturalWidth:200,naturalHeight:200};Object.defineProperty(img,'src',{set(){queueMicrotask(()=>img.onload());}});return img;}
  const l=Loader.create({terrain:{src:'terrain'},building:{src:'building'}},{imageFactory,maxBytes:400000});await l.load('terrain','high',true);await l.load('building');l.setBudget(100000);assert(l.stats().decodedBytes<=100000);
 });
 fs.mkdirSync('docs/qa-v2.10',{recursive:true});fs.writeFileSync('docs/qa-v2.10/visual-release-results.json',JSON.stringify({passed,failed:0},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
