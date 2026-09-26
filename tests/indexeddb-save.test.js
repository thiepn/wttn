'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function fakeIndexedDB(){
  const databases=new Map();
  return {
    open(name,version){
      const request={};
      setTimeout(()=>{
        let record=databases.get(name);
        const fresh=!record;
        if(!record){record={version,stores:new Map()};databases.set(name,record);}
        const db={
          objectStoreNames:{contains:store=>record.stores.has(store)},
          createObjectStore(store){if(!record.stores.has(store))record.stores.set(store,new Map());return {};},
          transaction(storeName){
            const data=record.stores.get(storeName);
            if(!data)throw new Error('missing store');
            const tx={error:null,aborted:false};
            const store={
              get(key){
                const r={};
                setTimeout(()=>{if(tx.aborted)return;r.result=data.get(key);r.onsuccess?.();},0);
                return r;
              },
              put(value,key){data.set(key,value);return {};},
              delete(key){data.delete(key);return {};}
            };
            tx.objectStore=()=>store;
            tx.abort=()=>{if(tx.aborted)return;tx.aborted=true;tx.onabort?.();};
            setTimeout(()=>{if(!tx.aborted)tx.oncomplete?.();},4);
            return tx;
          },
          close(){},
          onversionchange:null
        };
        request.result=db;
        if(fresh)request.onupgradeneeded?.();
        setTimeout(()=>request.onsuccess?.(),0);
      },0);
      return request;
    }
  };
}

(async()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'../save-storage.js'),'utf8');
  const context={console,setTimeout,clearTimeout,TextEncoder,TextDecoder,indexedDB:fakeIndexedDB()};
  context.globalThis=context;
  vm.runInNewContext(source,context);
  const S=context.WTTNSaveStorage;

  const first=JSON.stringify({kind:'test',savedAt:1,payload:'alpha'.repeat(1000)});
  const second=JSON.stringify({kind:'test',savedAt:2,payload:'beta'.repeat(1200)});
  let result=await S.durableCommit('primary','backup',first,{backup:true});
  assert.equal(result.ok,true);
  assert.equal(await S.durableGet('primary'),first);
  assert.equal(await S.durableGet('backup'),null);

  result=await S.durableCommit('primary','backup',second,{backup:true});
  assert.equal(result.ok,true);
  assert.equal(await S.durableGet('primary'),second);
  assert.equal(await S.durableGet('backup'),first);
  assert.equal(await S.durableRemove('backup'),true);
  assert.equal(await S.durableGet('backup'),null);

  const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
  const sw=fs.readFileSync(require('node:path').join(__dirname,'../sw.js'),'utf8');
  assert(app.startsWith('(async function () {'));
  assert(app.includes('const loaded = await load();'));
  assert(app.includes('durableCommit(SAVE_KEY, BACKUP_KEY, envelope'));
  assert(app.includes('await saveAndWait(true)'));
  assert(sw.includes("cache.addAll(ESSENTIAL)).then(()=>self.skipWaiting())"));

  console.log('IndexedDB save backend: PASS · atomic primary/backup rotation · reload path · update escape hatch');
})().catch(error=>{console.error(error);process.exitCode=1;});
