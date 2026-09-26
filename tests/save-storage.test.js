'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Storage=require('../save-storage'),G=require('../game-core'),S=require('../save-format');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const KEY='wttn.phase6.save.v6',BACKUP='wttn.phase6.backup.v6',LEGACY=['wttn.phase5.save.v5','wttn.phase4.save.v4','wttn.phase3.save.v3','wttn.phase2.save.v2','wttn.phase1.save.v1'];let passed=0;
const parseStored=(storage,key)=>S.parseSaveText(Storage.decode(storage.getItem(key)));
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function store(){const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
function setup(storage=store()){
 const nodes=new Map();
 function node(id){if(!nodes.has(id)){const classes=new Set();nodes.set(id,{textContent:'',hidden:true,classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)}});}return nodes.get(id);}
 const state=G.createState();state.producers.scribe=7;state.pages=G.bn(123456);
 const context={window:{localStorage:storage,WTTNSaveStorage:Storage},$:node,state,SAVE_KEY:KEY,BACKUP_KEY:BACKUP,LEGACY_SAVE_KEYS:LEGACY,makeEnvelope:S.makeEnvelope,parseSaveText:S.parseSaveText,saveQuarantined:false,storageAvailable:true,warnedAboutStorage:false,healthCache:{at:55},Date,console:{warn(){}},toast(){}};
 vm.createContext(context);
 vm.runInContext(app.slice(app.indexOf('  function storageGet('),app.indexOf('  function loadUiPreferences('))+app.slice(app.indexOf('  function updateSaveStatus('),app.indexOf('  function saveHealthText(')),context);
 return {context,node,storage,save:show=>vm.runInContext(`save(${!!show})`,context)};
}
test('actual save is verified and survives a new reader',()=>{const t=setup();assert(t.save());assert.equal(t.node('saveStatus').textContent,'Saved');assert(t.node('storageWarning').hidden);const loaded=parseStored(t.storage,KEY);assert.equal(loaded.state.producers.scribe,7);assert(loaded.state.pages.eq(123456));});
test('large saves are compacted in localStorage without changing the exported envelope',()=>{
 const text=S.makeEnvelope(G.createState()),stored=Storage.encode(text);
 assert(stored.startsWith(Storage.PACK_PREFIX));assert(stored.length<text.length*0.7);
 assert.equal(Storage.decode(stored),text);assert.deepEqual(S.parseSaveText(Storage.decode(stored)).state.version,G.VERSION);
});
test('app storage reads both compact current saves and legacy plain-text saves',()=>{
 const s=store(),plain=S.makeEnvelope(G.createState());s.setItem(KEY,Storage.encode(plain));
 const t=setup(s);assert.equal(vm.runInContext('storageGet(SAVE_KEY)',t.context),plain);
 s.setItem(KEY,plain);assert.equal(vm.runInContext('storageGet(SAVE_KEY)',t.context),plain);
});
test('full storage can replace a save even though the old extra probe fails',()=>{const s=store();s.setItem(KEY,S.makeEnvelope(G.createState()));const put=s.setItem;s.setItem=(key,value)=>{if(key!==KEY)throw Object.assign(new Error(),{name:'QuotaExceededError'});put(key,value);};const t=setup(s);assert(t.save());assert.equal(Storage.write(()=>s,'wttn.storage.probe','1').ok,false);assert(t.node('storageWarning').hidden);assert.equal(t.node('saveStatus').textContent,'Saved');assert(!app.includes("storageSet('wttn.storage.probe'"));});
test('silent dropped writes are not reported as saved',()=>{const t=setup({getItem:()=>null,setItem(){}});assert(!t.save());assert.equal(t.node('saveStatus').textContent,'Export-only');assert(!t.node('storageWarning').hidden);assert.match(t.node('storageWarningText').textContent,/did not keep/);});
test('quota errors identify storage capacity and preserve the previous save',()=>{const s=store(),old=S.makeEnvelope(G.createState());s.setItem(KEY,old);s.setItem=()=>{throw Object.assign(new Error(),{name:'QuotaExceededError'});};const t=setup(s);assert(!t.save());assert.equal(s.getItem(KEY),old);assert.match(t.node('storageWarningText').textContent,/no room/);});
test('quota recovery prioritizes the current save over redundant WTTN copies',()=>{
 const s=store(),old=S.makeEnvelope(G.createState()),legacy='wttn.phase5.save.v5',other='another.app.keep';
 s.setItem(KEY,old);s.setItem(BACKUP,old);s.setItem(legacy,old);s.setItem(other,'keep');
 const put=s.setItem.bind(s);
 s.setItem=(key,value)=>{
  if(key===KEY&&s.data.has(BACKUP))throw Object.assign(new Error(),{name:'QuotaExceededError'});
  if(key===BACKUP&&!s.data.has(BACKUP))throw Object.assign(new Error(),{name:'QuotaExceededError'});
  put(key,value);
 };
 const t=setup(s);t.context.state.producers.scribe=9;
 assert(t.save());assert.equal(parseStored(s,KEY).state.producers.scribe,9);
 assert.equal(s.getItem(BACKUP),null);assert.equal(s.getItem(legacy),null);assert.equal(s.getItem(other),'keep');
 assert.equal(t.node('saveStatus').textContent,'Saved');assert(t.node('storageWarning').hidden);
});
test('quota recovery never deletes the only valid backup behind a corrupt primary',()=>{
 const s=store(),good=S.makeEnvelope(G.createState());s.setItem(KEY,'corrupt');s.setItem(BACKUP,good);
 s.setItem=(key,value)=>{if(key===KEY)throw Object.assign(new Error(),{name:'QuotaExceededError'});s.data.set(key,value);};
 const t=setup(s);assert(!t.save());assert.equal(s.getItem(KEY),'corrupt');assert.equal(s.getItem(BACKUP),good);
 assert.match(t.node('storageWarningText').textContent,/no room/);
});
test('blocked storage is identified rather than reported as successful',()=>{const t=setup();Object.defineProperty(t.context.window,'localStorage',{get(){throw Object.assign(new Error(),{name:'SecurityError'});}});assert(!t.save());assert.match(t.node('storageWarningText').textContent,/blocking local saves/);});
test('save preparation failure is not blamed on browser storage',()=>{const s=store(),old=S.makeEnvelope(G.createState());s.setItem(KEY,old);const t=setup(s);t.context.makeEnvelope=()=>{throw new Error('serialization');};assert(!t.save());assert.equal(s.getItem(KEY),old);assert.equal(s.getItem(BACKUP),null);assert.equal(t.node('saveStatus').textContent,'Save preparation failed');assert.match(t.node('storageWarningText').textContent,/could not prepare/);});
test('an interface error after a verified write cannot report data loss',()=>{const t=setup();t.context.toast=()=>{throw new Error('display failure');};assert(t.save(true));assert.equal(S.parseSaveText(t.storage.getItem(KEY)).state.producers.scribe,7);assert.equal(t.node('saveStatus').textContent,'Saved');assert(t.node('storageWarning').hidden);});
test('retry clears the warning only after a verified successful save',()=>{const t=setup({getItem:()=>null,setItem(){throw new Error('temporary');}});assert(!t.save());assert(!t.node('storageWarning').hidden);t.context.window.localStorage=store();assert(t.save(true));assert(t.node('storageWarning').hidden);assert.equal(t.node('storageWarningText').textContent,'');assert.equal(t.node('saveStatus').textContent,'Saved');});
test('quarantine continues to protect stored recovery data',()=>{const t=setup();t.storage.setItem(KEY,'unreadable');t.context.saveQuarantined=true;assert(!t.save());assert.equal(t.storage.getItem(KEY),'unreadable');assert.equal(t.node('saveStatus').textContent,'Recovery needed');});
test('warning is natively hidden and empty before scripts run',()=>{assert.match(html,/<aside id="storageWarning"[^>]* hidden /);assert.match(html,/<p id="storageWarningText"[^>]*><\/p>/);assert(html.indexOf('src="save-storage.js"')<html.indexOf('src="app.js"'));assert(app.includes("$('retrySaveBtn').onclick = () => save(true)"));assert(app.includes("$('exportWarningBtn').onclick = () => $('exportBtn').click()"));});
test('visible warning cascade cannot combine top anchoring with bottom positioning',()=>{
 const path=require('node:path'),resolved={};let order=0;
 // Resolve the actual warning selectors across both shipped stylesheets.
 for(const file of ['shared-components.css','settlement.css']){
  const css=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  for(const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
   for(const selector of rule[1].split(',').map(s=>s.trim())){
    const specificity={'*':0,'aside':1,'.storage-warning':10,'#storageWarning':100}[selector];
    if(specificity===undefined)continue;
    for(const declaration of rule[2].split(';')){
     const split=declaration.indexOf(':');if(split<0)continue;
     const property=declaration.slice(0,split).trim(),value=declaration.slice(split+1).trim();
     const score=specificity+(value.includes('!important')?1000:0),prior=resolved[property];
     if(!prior||score>=prior.score)resolved[property]={value,score,order:order++};
    }
   }
  }
 }
 assert.equal(resolved.top.value,'auto');assert.equal(resolved.right.value,'auto');
 assert.equal(resolved.height.value,'auto');assert.equal(resolved.left.value,'50%');
 assert.equal(resolved.background.value,'#fff4d9');
});
console.log(`${passed} save-storage regression groups passed`);
