/* Verified local writes with transparent compact storage for large save payloads. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WTTNSaveStorage=api;})(globalThis,function(){
  'use strict';

  const PACK_PREFIX='WTTNPK1:';
  const PACK_THRESHOLD=768;

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

  function write(getStorage,key,value){
    try{
      const storage=getStorage();
      if(!storage||typeof storage.setItem!=='function')return {ok:false,reason:'unavailable'};
      const stored=encode(value);
      storage.setItem(key,stored);
      if(storage.getItem(key)!==stored)return {ok:false,reason:'verification'};
      return {ok:true,compact:stored!==value,storedLength:stored.length,sourceLength:String(value).length};
    }catch(error){
      const name=error?.name;
      return {ok:false,reason:name==='QuotaExceededError'||name==='NS_ERROR_DOM_QUOTA_REACHED'?'quota':name==='SecurityError'||name==='NotAllowedError'?'blocked':'unavailable'};
    }
  }

  function message(reason){
    if(reason==='quota')return 'This site’s local save space is full. WTTN already compacted its save and reclaimed its obsolete copies, but the browser still refused the write. Export your progress before changing site data.';
    if(reason==='blocked')return 'This browser is blocking local saves. Allow site storage or open the game directly in a regular browser tab, then retry. Export your progress before leaving this tab.';
    if(reason==='verification')return 'The browser did not keep the save just written. Retry saving, or export your progress before leaving this tab.';
    if(reason==='serialization')return 'The game could not prepare this save. Your last stored save is unchanged. Keep this tab open and retry saving.';
    return 'The game could not write to browser storage. Retry saving, or export your progress before leaving this tab.';
  }

  return {PACK_PREFIX,PACK_THRESHOLD,encode,decode,write,message};
});
