/* One active writer per browser origin. Closing the active tab releases the lock. */
(function(root){
  'use strict';
  function acquire(locks,waiting=()=>{}){
    if(!locks?.request)return Promise.resolve({supported:false});
    return new Promise((resolve,reject)=>{
      let acquired=false;
      const timer=setTimeout(()=>{if(!acquired)waiting();},150);
      locks.request('wttn-campaign-writer-v1',{mode:'exclusive'},()=>{
        acquired=true;clearTimeout(timer);resolve({supported:true});
        return new Promise(()=>{}); // Browser releases this on document destruction.
      }).catch(error=>{clearTimeout(timer);reject(error);});
    });
  }
  root.WTTNTabGuard={acquire};
  if(typeof module==='object')module.exports={acquire};
})(globalThis);
