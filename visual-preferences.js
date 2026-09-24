/* Device preferences and portable arrangements share storage, not economic state. */
(function(root){'use strict';
const KEY='wttn.visual.v1',A=root.WTTNAppearance,defaults={quality:'auto',motion:'system',labels:'contextual',decorations:[],placements:{}},options={quality:['auto','high','low'],motion:['system','full','reduce'],labels:['contextual','all']};
const fallbackIds=['pergola','fountain','lemon','garden','amphorae','cypress','market','mosaic','birdbath','readingBench','flowers','handcart'];
const valid=(key,next)=>key==='placements'?!!A?.validate(next).ok:key==='decorations'?Array.isArray(next)&&next.length<=12&&next.every(id=>fallbackIds.includes(id)):!!options[key]?.includes(next);
let value={...defaults};try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');for(const k of Object.keys(options))if(valid(k,saved[k]))value[k]=saved[k];if(A?.restore(saved.placements).ok)value.placements=A.restore(saved.placements).placements;else if(valid('decorations',saved.decorations))value.placements=Object.fromEntries(saved.decorations.map(id=>[id,'home']));value.decorations=Object.keys(value.placements);}catch(_){}
const listeners=new Set(),copy=()=>({...value,decorations:[...value.decorations],placements:{...value.placements}});
function reduced(){return value.motion==='reduce'||(value.motion==='system'&&(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduce'));}
function quality(){return value.quality==='auto'?(navigator.connection?.saveData?'low':root.innerWidth<700?'medium':'high'):value.quality;}
function notify(){document.documentElement.dataset.visualMotion=reduced()?'reduce':'full';listeners.forEach(fn=>fn(copy()));}
function set(key,next){if(!valid(key,next))return false;const updated=copy();if(key==='placements'){updated.placements=A.validate(next).placements;updated.decorations=Object.keys(updated.placements);}else if(key==='decorations'){updated.decorations=[...new Set(next)];updated.placements=Object.fromEntries(updated.decorations.map(id=>[id,value.placements[id]||'home']));if(A&&!A.validate(updated.placements).ok)return false;}else updated[key]=next;try{localStorage.setItem(KEY,JSON.stringify(updated));}catch(_){return false;}value=updated;notify();return true;}
function adoptPlacements(placements){if(!valid('placements',placements))return false;value.placements=A.validate(placements).placements;value.decorations=Object.keys(value.placements);notify();return true;}
root.WTTNVisualPreferences={KEY,get:copy,set,quality,reduced,adoptPlacements,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
})(globalThis);
