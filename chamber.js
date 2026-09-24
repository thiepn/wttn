/* Room presentation is derived from authoritative game state. */
(() => {
 const host=document.getElementById('chamberArt'),stage=host.closest('.chamber-stage'),manifest=window.WTTNArtManifest;
 host.innerHTML='<img id="roomImage" alt="" width="1536" height="1024" decoding="async"><div class="room-sunlight"></div><div class="room-motes"><i></i><i></i><i></i></div>';
 const atlasViewport=document.getElementById('atlasViewport');
 atlasViewport.style.setProperty('--atlas-painted',`url("${manifest.atlas.fallback}")`);
 let atlasLoaded=false;
 new MutationObserver(()=>{if(atlasLoaded||window.WTTN_PORTABLE||!document.getElementById('atlasDialog').open)return;atlasLoaded=true;const detail=new Image();detail.onload=()=>atlasViewport.style.setProperty('--atlas-painted',`url("${detail.src}")`);detail.src=matchMedia('(max-width:760px)').matches?manifest.atlas.small:manifest.atlas.large;}).observe(document.getElementById('atlasDialog'),{attributes:true,attributeFilter:['open']});
 let sceneId='',lastEquipment=-1;const image=document.getElementById('roomImage');
 const rail=document.querySelector('.navigation-rail'),more=document.getElementById('chamberMore');
 more.addEventListener('click',()=>{const open=more.getAttribute('aria-expanded')!=='true';more.setAttribute('aria-expanded',String(open));rail.classList.toggle('menu-open',open)});
 document.getElementById('gameTabs').addEventListener('click',e=>{if(e.target.closest('.tab')){rail.classList.remove('menu-open');more.setAttribute('aria-expanded','false')}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&rail.classList.contains('menu-open')){rail.classList.remove('menu-open');more.setAttribute('aria-expanded','false');more.focus()}});
 document.getElementById('chamberCollapse').onclick=e=>{const collapsed=stage.classList.toggle('room-collapsed');e.currentTarget.setAttribute('aria-expanded',String(!collapsed));e.currentTarget.textContent=collapsed?'Show room':'Hide room'};
 document.addEventListener('visibilitychange',()=>document.body.classList.toggle('workshop-suspended',document.hidden));
 window.WTTNChamber={update(state){
 const scene=window.WTTNWorkshopModel.scene(state);stage.dataset.scene=scene.id;stage.classList.toggle('room-working',scene.active);
 if(sceneId!==scene.id){sceneId=scene.id;const asset=manifest[scene.id];image.src=asset.fallback;
 if(!window.WTTN_PORTABLE){const detail=new Image(),requested=scene.id;detail.onload=()=>{if(sceneId===requested)image.src=detail.src};detail.src=matchMedia('(max-width:760px)').matches?asset.small:asset.large;}
 stage.querySelector('.chamber-heading h2').textContent=scene.title;
 stage.querySelector('.chamber-heading .eyebrow').textContent=`CHAPTER ${scene.index+1} · THE LIVING WORKSHOP`;
 document.getElementById('chamberCaption').textContent=scene.description;}
 if(lastEquipment!==scene.equipment){lastEquipment=scene.equipment;stage.classList.remove('room-improved');void host.offsetWidth;stage.classList.add('room-improved');}
 document.getElementById('chamberActivity').textContent=scene.active?`${scene.equipment} Methods · ${scene.projects} Projects`:'Your first desk awaits';
 }};
})();
