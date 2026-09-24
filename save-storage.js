/* Verified local writes. No save format, key, or economic changes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WTTNSaveStorage=api;})(globalThis,function(){
  'use strict';
  function write(getStorage,key,value){
    try{
      const storage=getStorage();
      if(!storage||typeof storage.setItem!=='function')return {ok:false,reason:'unavailable'};
      storage.setItem(key,value);
      if(storage.getItem(key)!==value)return {ok:false,reason:'verification'};
      return {ok:true};
    }catch(error){
      const name=error?.name;
      return {ok:false,reason:name==='QuotaExceededError'||name==='NS_ERROR_DOM_QUOTA_REACHED'?'quota':name==='SecurityError'||name==='NotAllowedError'?'blocked':'unavailable'};
    }
  }
  function message(reason){
    if(reason==='quota')return 'The browser has no room for this save. Export your progress, free some storage for this site, then retry. Do not clear this game’s data without an export.';
    if(reason==='blocked')return 'This browser is blocking local saves. Allow site storage or open the game directly in a regular browser tab, then retry. Export your progress before leaving this tab.';
    if(reason==='verification')return 'The browser did not keep the save just written. Retry saving, or export your progress before leaving this tab.';
    if(reason==='serialization')return 'The game could not prepare this save. Your last stored save is unchanged. Keep this tab open and retry saving.';
    return 'The game could not write to browser storage. Retry saving, or export your progress before leaving this tab.';
  }
  return {write,message};
});
