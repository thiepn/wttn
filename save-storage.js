/* Verified local writes with IndexedDB durability and compact localStorage compatibility. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.WTTNSaveStorage=api;})(globalThis,function(root){
  'use strict';

  const PACK_PREFIX='WTTNPK1:';
  const PACK_THRESHOLD=768;
  const DB_NAME='wttn-durable-save-v1';
  const DB_VERSION=1;
  const STORE='kv';
  let dbPromise=null;

  function utf8Encode(value){
    if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(value);
    const escaped=unescape(encodeURIComponent(value)),bytes=new Uint8Array(escaped.length);
    for(let i=0;i<escaped.length;i++)bytes[i]=escaped.charCodeAt(i);
    return bytes;
  }

  function utf8Decode(bytes){
    if(typeof TextDecoder!=='undefined')return new TextDecoder().decode(bytes);
    let escaped='';
    for(let i=0;i<bytes.length;i++)escaped+=String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(escaped));
  }

  function packBytes(bytes){
    let out=PACK_PREFIX+String.fromCharCode(bytes.length&0xffff,Math.floor(bytes.length/0x10000)&0xffff);
    let chunk=[];
    for(let i=0;i<bytes.length;i+=2){
      chunk.push(bytes[i]|((i+1<bytes.length?bytes[i+1]:0)<<8));
      if(chunk.length===8192){out+=String.fromCharCode(...chunk);chunk=[];}
    }
    if(chunk.length)out+=String.fromCharCode(...chunk);
    return out;
  }

  function unpackBytes(stored){
    if(typeof stored!=='string'||!stored.startsWith(PACK_PREFIX))return null;
    const base=PACK_PREFIX.length;
    if(stored.length<base+2)throw new Error('Packed save header is incomplete.');
    const length=stored.charCodeAt(base)+(stored.charCodeAt(base+1)*0x10000);
    const words=stored.length-base-2;
    if(words!==Math.ceil(length/2))throw new Error('Packed save length is invalid.');
    const bytes=new Uint8Array(length);
    for(let i=0;i<words;i++){
      const word=stored.charCodeAt(base+2+i),j=i*2;
      bytes[j]=word&0xff;
      if(j+1<length)bytes[j+1]=(word>>>8)&0xff;
    }
    return bytes;
  }

  function encode(value){
    value=String(value);
    if(value.length<PACK_THRESHOLD)return value;
    try{
      const packed=packBytes(utf8Encode(value));
      return packed.length<value.length?packed:value;
    }catch(_){return value;}
  }

  function decode(stored){
    if(stored==null||typeof stored!=='string'||!stored.startsWith(PACK_PREFIX))return stored;
    return utf8Decode(unpackBytes(stored));
  }

  function reason(error){
    const name=error?.name;
    if(name==='QuotaExceededError'||name==='NS_ERROR_DOM_QUOTA_REACHED')return 'quota';
    if(name==='SecurityError'||name==='NotAllowedError')return 'blocked';
    return 'unavailable';
  }

  function write(getStorage,key,value){
    try{
      const storage=getStorage();
      if(!storage||typeof storage.setItem!=='function')return {ok:false,reason:'unavailable'};
      const stored=encode(value);
      storage.setItem(key,stored);
      if(storage.getItem(key)!==stored)return {ok:false,reason:'verification'};
      return {ok:true,compact:stored!==value,storedLength:stored.length,sourceLength:String(value).length};
    }catch(error){return {ok:false,reason:reason(error)};}
  }

  function openDurable(){
    if(!root?.indexedDB)return Promise.resolve(null);
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      let request;
      try{request=root.indexedDB.open(DB_NAME,DB_VERSION);}catch(error){reject(error);return;}
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
      };
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>{try{db.close();}catch(_){}dbPromise=null;};
        resolve(db);
      };
      request.onerror=()=>reject(request.error||new Error('IndexedDB open failed.'));
      request.onblocked=()=>reject(Object.assign(new Error('IndexedDB open blocked.'),{name:'InvalidStateError'}));
    }).catch(error=>{dbPromise=null;throw error;});
    return dbPromise;
  }

  async function durableGet(key){
    const db=await openDurable();
    if(!db)return null;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const request=tx.objectStore(STORE).get(key);
      request.onsuccess=()=>{try{resolve(decode(request.result??null));}catch(error){reject(error);}};
      request.onerror=()=>reject(request.error||new Error('IndexedDB read failed.'));
      tx.onabort=()=>reject(tx.error||new Error('IndexedDB read aborted.'));
    });
  }

  async function durableCommit(primaryKey,backupKey,value,{backup=true}={}){
    let db;
    try{db=await openDurable();}catch(error){return {ok:false,reason:reason(error),error};}
    if(!db)return {ok:false,reason:'unsupported'};
    const stored=encode(value);
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
        let started=false;
        const current=store.get(primaryKey);
        current.onsuccess=()=>{
          if(started)return;
          started=true;
          if(backup&&typeof current.result==='string')store.put(current.result,backupKey);
          store.put(stored,primaryKey);
        };
        current.onerror=()=>{try{tx.abort();}catch(_){}};
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error('IndexedDB write failed.'));
        tx.onabort=()=>reject(tx.error||current.error||new Error('IndexedDB write aborted.'));
      });
      const verify=await durableGet(primaryKey);
      if(verify!==String(value))return {ok:false,reason:'verification'};
      return {ok:true,compact:stored!==value,storedLength:stored.length,sourceLength:String(value).length};
    }catch(error){return {ok:false,reason:reason(error),error};}
  }

  async function durablePut(key,value){
    let db;
    try{db=await openDurable();}catch(error){return {ok:false,reason:reason(error),error};}
    if(!db)return {ok:false,reason:'unsupported'};
    const stored=encode(value);
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put(stored,key);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error('IndexedDB write failed.'));
        tx.onabort=()=>reject(tx.error||new Error('IndexedDB write aborted.'));
      });
      return (await durableGet(key))===String(value)?{ok:true}:{ok:false,reason:'verification'};
    }catch(error){return {ok:false,reason:reason(error),error};}
  }

  async function durableRemove(key){
    let db;
    try{db=await openDurable();}catch(error){return false;}
    if(!db)return false;
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error('IndexedDB delete failed.'));
        tx.onabort=()=>reject(tx.error||new Error('IndexedDB delete aborted.'));
      });
      return (await durableGet(key))===null;
    }catch(_){return false;}
  }

  function message(saveReason){
    if(saveReason==='quota')return 'Browser storage refused this save. WTTN also tried its larger IndexedDB save store. Export your progress before changing site data.';
    if(saveReason==='blocked')return 'This browser is blocking persistent saves. Allow site storage or open the game directly in a regular browser tab, then retry. Export your progress before leaving this tab.';
    if(saveReason==='verification')return 'The browser did not keep the save just written. Retry saving, or export your progress before leaving this tab.';
    if(saveReason==='serialization')return 'The game could not prepare this save. Your last stored save is unchanged. Keep this tab open and retry saving.';
    return 'The game could not write to persistent browser storage. Retry saving, or export your progress before leaving this tab.';
  }

  return {PACK_PREFIX,PACK_THRESHOLD,DB_NAME,encode,decode,write,durableGet,durableCommit,durablePut,durableRemove,message};
});
