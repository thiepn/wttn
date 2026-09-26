'use strict';
const BUILD='__BUILD_ID__';
const PREFIX='wttn-app-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CORE=PREFIX+BUILD, ART=CORE+'-art';
const ESSENTIAL=/*__ESSENTIAL__*/[], ASSETS=/*__ASSETS__*/[];
const absolute=p=>new URL(p,self.registration.scope).href;
const coreURLs=new Set(ESSENTIAL.map(absolute)),artURLs=new Set(ASSETS.map(absolute));
self.addEventListener('install',event=>event.waitUntil(caches.open(CORE).then(cache=>cache.addAll(ESSENTIAL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CORE&&k!==ART).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// app.js saves first; updates wait for the explicit safe-reload action.
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){event.respondWith(caches.open(CORE).then(async c=>(await c.match(absolute('./index.html')))||fetch(request)));return;}
 if(coreURLs.has(url.href)){event.respondWith(caches.open(CORE).then(async c=>(await c.match(request))||fetch(request)));return;}
 if(artURLs.has(url.href))event.respondWith((async()=>{
  // Optional cache failures must never turn a successful artwork download into
  // a failed request (for example when the browser's storage quota is full).
  let cache;try{cache=await caches.open(ART);const stored=await cache.match(request);if(stored)return stored;}catch(_){}
  const response=await fetch(request);
  if(response.ok&&cache)try{await cache.put(request,response.clone());const keys=await cache.keys();for(const k of keys.slice(0,Math.max(0,keys.length-48)))await cache.delete(k);}catch(_){}
  return response;
 })());
});
