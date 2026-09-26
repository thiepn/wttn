'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../full-backup'),S=require('../save-format'),G=require('../game-core'),A=require('../appearance-model');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const keys={save:'save',backup:'backup',preferences:'prefs'};
function fixture(){
 const original=S.makeEnvelope(G.createState()),next=G.createState();next.pages=G.bn(999);
 const prefs={quality:'low',motion:'reduce',placements:{fountain:'home'},decorations:['fountain']};
 const parsed=F.parse(F.make(S.makeEnvelope(next),{pergola:'home'}));
 const data=new Map([['save',original],['prefs',JSON.stringify(prefs)]]);
 return {original,prefs,parsed,data,storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
}
test('silent loss at each full-import write cannot report success',()=>{
 for(let drop=1;drop<=5;drop++){
  const f=fixture();let writes=0;const put=f.storage.setItem;
  f.storage.setItem=(k,v)=>{if(++writes!==drop)put(k,v);};
  assert.throws(()=>F.commit(f.storage,f.parsed,f.original,f.prefs,keys),/could not be stored/);
  assert.equal(f.data.get('save'),f.original);
  assert.deepEqual(JSON.parse(f.data.get('prefs')).placements,f.prefs.placements);
 }
});
test('a persistent failed recovery write retains its journal for next startup',()=>{
 const f=fixture(),put=f.storage.setItem;f.storage.setItem=(k,v)=>{if(k!=='prefs'&&!(k==='save'&&v===f.original))put(k,v);};
 assert.throws(()=>F.commit(f.storage,f.parsed,f.original,f.prefs,keys));
 assert(f.data.has(F.JOURNAL_KEY));
 f.storage.setItem=put;assert.deepEqual(F.recoverPending(f.storage,keys),f.prefs.placements);
 assert.equal(f.data.get('save'),f.original);assert(!f.data.has(F.JOURNAL_KEY));
});
test('silently dropped journal removal rolls back instead of reporting a completed import',()=>{
 const f=fixture();f.storage.removeItem=()=>{};
 assert.throws(()=>F.commit(f.storage,f.parsed,f.original,f.prefs,keys));
 assert.equal(f.data.get('save'),f.original);assert(f.data.has(F.JOURNAL_KEY));
 assert.deepEqual(JSON.parse(f.data.get('prefs')).placements,f.prefs.placements);
});
test('recovery accepts malformed device preferences without losing saved appearance',()=>{
 for(const preferences of ['null','[]','42','"text"','{broken']){
  const f=fixture();f.data.set(F.JOURNAL_KEY,F.make(f.original,f.prefs.placements));f.data.set('prefs',preferences);
  assert.deepEqual(F.recoverPending(f.storage,keys),f.prefs.placements);
  assert(!f.data.has(F.JOURNAL_KEY));
 }
});
test('another import cannot overwrite an unresolved recovery journal',()=>{
 const f=fixture(),journal=F.make(f.original,f.prefs.placements);f.data.set(F.JOURNAL_KEY,journal);
 const before=[...f.data];assert.throws(()=>F.commit(f.storage,f.parsed,f.original,f.prefs,keys),/recovery/);
 assert.deepEqual([...f.data],before);
});
test('verified full import commits both progress and appearance and preserves device choices',()=>{
 const f=fixture();F.commit(f.storage,f.parsed,f.original,f.prefs,keys);
 assert(S.parseSaveText(f.data.get('save')).state.pages.eq(999));
 const prefs=JSON.parse(f.data.get('prefs'));assert.equal(prefs.quality,'low');assert.equal(prefs.motion,'reduce');
 assert.deepEqual(prefs.placements,{pergola:'home'});assert(!f.data.has(F.JOURNAL_KEY));
});
test('visual preferences do not adopt silently discarded changes',()=>{
 const context={WTTNAppearance:A,localStorage:{getItem:()=>null,setItem(){}},document:{documentElement:{dataset:{}}},navigator:{},innerWidth:1280};
 vm.runInNewContext(fs.readFileSync('visual-preferences.js','utf8'),context);
 const p=context.WTTNVisualPreferences;assert.equal(p.set('quality','low'),false);assert.equal(p.get().quality,'auto');
 assert.equal(p.set('placements',{pergola:'home'}),false);assert.deepEqual(Object.keys(p.get().placements),[]);
});
test('reference searches normalize typed dashes, spacing and case without changing Scripture',()=>{
 const context={};vm.runInNewContext(fs.readFileSync('workshop-screens.js','utf8'),context);
 const normalize=context.WTTNWorkshopScreens.normalizeSearch;
 assert.equal(normalize('  GENESIS  11:1 - 9  '),normalize('Genesis 11:1–9'));
 assert.equal(normalize('John 20 : 19—23'),normalize('John 20:19-23'));
 assert.equal(normalize('  '),'');assert.equal(normalize('Lord’s'),normalize("lord's"));
});
test('edited order inputs follow model changes without interrupting active typing',()=>{
 const context={};vm.runInNewContext(fs.readFileSync('ui-renderer.js','utf8').replace('return { patch };','return { patch, reconcile };'),context);
 function input(value){const attrs=new Map([['value',value]]);return {nodeType:1,tagName:'INPUT',childNodes:[],value,ownerDocument:{activeElement:null},get attributes(){return [...attrs].map(([name,value])=>({name,value}));},getAttribute:k=>attrs.get(k)??null,hasAttribute:k=>attrs.has(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};}
 const current=input('50');current.value='50';context.WTTNView.reconcile(current,input('40'));assert.equal(current.value,'40');
 current.value='75';current.ownerDocument.activeElement=current;context.WTTNView.reconcile(current,input('60'));assert.equal(current.value,'75');
});
(async()=>{
 for(const failure of ['open','match','put','keys','delete',null]){
  let fetches=0,response;const events={};const network={ok:true,clone(){return this;}};
  const cache={async match(){if(failure==='match')throw Error('blocked');return null;},async put(){if(failure==='put')throw Error('quota');},async keys(){if(failure==='keys')throw Error('quota');return Array.from({length:50},(_,i)=>String(i));},async delete(){if(failure==='delete')throw Error('blocked');}};
  const context={URL,self:{registration:{scope:'https://example.test/game/'},location:{origin:'https://example.test'},addEventListener:(n,fn)=>events[n]=fn},caches:{async open(){if(failure==='open')throw Error('blocked');return cache;}},async fetch(){fetches++;return network;}};
  const source=fs.readFileSync('sw.js','utf8').replace('/*__ASSETS__*/[]',JSON.stringify(['./art.webp']));
  vm.runInNewContext(source,context);events.fetch({request:{method:'GET',url:'https://example.test/game/art.webp'},respondWith(p){response=p;}});
  assert.equal(await response,network);assert.equal(fetches,1);
 }
 passed++;console.log('PASS optional artwork still loads when any cache operation fails');
 console.log(`${passed} audit repair regression groups passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
