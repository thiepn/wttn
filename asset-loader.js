/* One bounded image pool for Settlement and Journey. Failures are negative-cached. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WTTNAssetLoader=api;})(globalThis,function(){'use strict';
 function create(manifest,{concurrency=3,maxBytes=96*1024*1024,imageFactory=()=>new Image(),changed=()=>{}}={}){
  const entries=new Map(),failed=new Set(),pending=new Map(),queue=[],listeners=new Set([changed]);let active=0,clock=0,decoded=0,visible=new Set();
  concurrency=Math.max(1,Math.min(3,concurrency));
  function trim(protect){for(const [key,item] of [...entries].sort((a,b)=>(Number(visible.has(a[0]))-Number(visible.has(b[0])))||a[1].used-b[1].used)){if(decoded<=maxBytes)break;if(key===protect)continue;entries.delete(key);decoded-=item.bytes;}}
  function pump(){queue.sort((a,b)=>Number(visible.has(b.key))-Number(visible.has(a.key))||b.priority-a.priority);while(active<concurrency&&queue.length){const task=queue.shift();active++;const image=imageFactory();image.decoding='async';let settled=false;const timer=setTimeout(()=>finish(false),15000);
   const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);active--;pending.delete(task.url);const bytes=image.naturalWidth*image.naturalHeight*4;
    if(ok&&bytes>0&&bytes<=maxBytes){const old=entries.get(task.key);if(old)decoded-=old.bytes;entries.set(task.key,{image,url:task.url,level:task.level,used:++clock,bytes});decoded+=bytes;trim(task.key);}else{ok=false;failed.add(task.url);}
    task.resolve(ok?image:entries.get(task.key)?.image||null);for(const fn of listeners)fn(task.key,ok);pump();};
   image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=task.url;
  }}
  function load(key,level='low',priority=0){const spec=manifest[key];if(!spec)return Promise.resolve(null);const url=spec.variants?.[level]||spec.variants?.low||spec.src;if(!url)return Promise.resolve(null);const current=entries.get(key);if(current?.url===url){current.used=++clock;return Promise.resolve(current.image);}if(failed.has(url))return Promise.resolve(current?.image||null);if(pending.has(url))return pending.get(url);const promise=new Promise(resolve=>queue.push({key,url,level,priority:Number(priority)||0,resolve}));pending.set(url,promise);pump();return promise;}
  function get(key){const entry=entries.get(key);if(entry)entry.used=++clock;return entry?.image||null;}
  return {load,get,level:key=>entries.get(key)?.level,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},prioritize(keys){visible=new Set(keys);pump();},setBudget(bytes){maxBytes=bytes;trim();},stats:()=>({decodedBytes:decoded,budgetBytes:maxBytes,activeDownloads:active,queued:queue.length,resident:[...entries.keys()],failed:[...failed]})};
 }
 let pool;function shared(manifest,options){return pool||(pool=create(manifest,options));}
 return {create,shared};
});
