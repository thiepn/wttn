'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../settlement-animation'),V=require('../settlement-model'),G=require('../game-core');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
const c={window:{}};vm.runInNewContext(fs.readFileSync('settlement-assets.js','utf8'),c);const bounds=c.window.WTTNSettlementArt.bounds;
test('extended terrain covers every viewport at camera limits and extreme pan positions',()=>{
 for(const [width,height] of [[1488,1060],[1920,1080],[875,898],[700,1000],[390,844],[320,568],[2560,1080]]){
  const minimum=Math.max(width/bounds.w,height/bounds.h);
  for(const scale of [minimum,minimum*1.5,minimum*3])for(const x of [-10000,0,10000])for(const y of [-10000,0,10000]){
   const t=R.constrain({width,height,scale,x,y},bounds);
   assert(t.x+bounds.x*scale<=1e-7);assert(t.y+bounds.y*scale<=1e-7);
   assert(t.x+(bounds.x+bounds.w)*scale>=width-1e-7);assert(t.y+(bounds.y+bounds.h)*scale>=height-1e-7);
  }
 }
});
test('selected buildings can be framed clear of the journal, inspector and phone sheet',()=>{
 for(const [width,height,safe,scale] of [[1488,1060,{x:20,y:185,w:1124,h:770},.68],[875,898,{x:20,y:172,w:835,h:421},.50],[390,844,{x:49,y:178,w:292,h:395},.60]]){
  for(const site of V.sites){
   const t=R.frameSite({x:-300,y:-100,width,height,scale},site,safe,bounds),r=R.visibleRect(site,t,t.scale);
   assert(r.top>=safe.y-1e-5,site.id+' top');assert(r.bottom<=safe.y+safe.h+1e-5,site.id+' bottom');
   assert(r.left>=safe.x-1e-5,site.id+' left');assert(r.right<=safe.x+safe.w+1e-5,site.id+' right');
  }
 }
});
test('every representative worker remains outdoors throughout the complete route cycle',()=>{
 for(const site of V.sites)for(let index=0;index<4;index++)for(let time=0;time<=120000;time+=250){
  const p=R.worker(site,index,time,false);
  for(const b of V.sites)assert(!(p.x>b.x-b.w*.26&&p.x<b.x+b.w*.26&&p.y>b.y-b.h*.39&&p.y<b.y-9),`${site.id}/${index} crossed ${b.id}`);
 }
});
test('all six workforces keep advancing on the same clock, regardless of selection',()=>{
 for(const site of V.sites)for(let i=0;i<4;i++){
  const a=R.worker(site,i,1000,false),b=R.worker(site,i,12000,false);
  assert.notDeepEqual(a,b,site.id+' worker pose '+i);
  const cycle=Array.from({length:241},(_,n)=>R.worker(site,i,n*500,false));
  assert(cycle.some(p=>p.walking)&&cycle.some(p=>!p.walking),site.id+' work and travel');
  assert(cycle.some(p=>Math.hypot(p.x-a.x,p.y-a.y)>30),site.id+' delivery route');
  assert.deepEqual(R.worker(site,i,1000,true),R.worker(site,i,12000,true));
 }
});
test('touch zoom accepts a viewport-specific minimum without moving the touched point',()=>{
 const camera={width:875,height:898,zoom:1.3,scale:.62,panX:10,panY:-45,minZoom:1.1},start={x:200,y:350,distance:100},current={x:260,y:370,distance:30};
 const r=R.pinchCamera(camera,start,current);assert.equal(r.zoom,1.1);
 const project=(p,c)=>[(p.x-(c.width-1536*c.scale)/2-c.panX)/c.scale,(p.y-(c.height-1024*c.scale)/2-c.panY)/c.scale];
 const a=project(start,camera),b=project(current,{...camera,...r});assert(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8);
});
test('twelve decorations persist independently, validate imports, and cannot mutate economic state',()=>{
 const source=fs.readFileSync('visual-preferences.js','utf8'),s=G.createState(),before=JSON.stringify(s),store={};
 function boot(){const context={localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v},document:{documentElement:{dataset:{}}},navigator:{},innerWidth:1488};vm.runInNewContext(source,context);return context.WTTNVisualPreferences;}
 let p=boot();assert.equal(p.get().decorations.length,0);
 const all=['pergola','fountain','lemon','garden','amphorae','cypress','market','mosaic','birdbath','readingBench','flowers','handcart'];assert(p.set('decorations',all));all.pop();assert.equal(p.get().decorations.length,12);
 const copy=p.get();copy.decorations.length=0;assert.equal(p.get().decorations.length,12);
 assert(!p.set('decorations',['__proto__']));assert(!p.set('decorations','pergola'));assert(!p.set('unknown','value'));
 p=boot();assert.equal(p.get().decorations.length,12);assert(p.set('decorations',[]));assert.equal(boot().get().decorations.length,0);assert.equal(JSON.stringify(s),before);
});
test('actual renderer loop pauses behind menus and hidden tabs, then resumes once',()=>{
 const source=fs.readFileSync('settlement-scene.js','utf8'),loop=source.slice(source.indexOf(' function loop('),source.indexOf(' function start('));
 for(const [hidden,surface,reduced,dirty,expected] of [[true,'settlement',false,true,0],[false,'menu',false,true,0],[false,'journey',false,true,0],[false,'settlement',false,false,1],[false,'settlement',true,true,1]]){
  const c={document:{hidden,body:{dataset:{surface}}},frameId:1,last:100,dirty,calm:()=>reduced,drawn:0,scheduled:0,draw(){c.drawn++;},requestAnimationFrame(){c.scheduled++;return 2;}};
  vm.runInNewContext(loop+';loop(200)',c);assert.equal(c.drawn,expected);assert.equal(c.scheduled,expected&&!reduced?1:0);if(!expected)assert.equal(c.last,0);
 }
});
fs.mkdirSync('docs/qa-v2.9',{recursive:true});fs.writeFileSync('docs/qa-v2.9/settlement-v29-results.json',JSON.stringify({passed,failed:0},null,2));
