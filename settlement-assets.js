/* Manifest sources are rewritten to content-hashed URLs by the web builder. */
window.WTTNSettlementArt={width:1536,height:1024,bounds:{x:-628.012,y:-436.01,w:2848.476,h:1874.038},anchor:{x:.5,y:.92},interaction:{x:.14,y:.2,w:.72,h:.72},assets:{
 terrain:{variants:{low:'assets/world/terrain-low.webp',medium:'assets/world/terrain-medium.webp',high:'assets/world/terrain-high.webp'},width:1536,height:1024,layers:[{id:'sky-sea',y:0,h:220},{id:'coastline',y:220,h:190},{id:'terraces',y:410,h:614}]},
 'buildings-a':{variants:{low:'assets/settlement/buildings-a-low.webp',medium:'assets/settlement/buildings-a-medium.webp',high:'assets/settlement/buildings-a.webp'},columns:3,rows:3,trimBottom:64},
 'buildings-b':{variants:{low:'assets/settlement/buildings-b-low.webp',medium:'assets/settlement/buildings-b-medium.webp',high:'assets/settlement/buildings-b.webp'},columns:3,rows:3,trimBottom:64},
 decorations:{"variants": {"low": "assets/world/decorations-low.webp", "medium": "assets/world/decorations-medium.webp", "high": "assets/world/decorations-high.webp"}, "columns": 4, "rows": 3, "sourceWidth": 1448, "sourceHeight": 1086, "regions": {"0": [21, 18, 341, 342], "1": [385, 55, 329, 307], "2": [741, 15, 345, 347], "3": [1086, 108, 353, 247], "4": [27, 422, 332, 272], "5": [427, 362, 243, 349], "6": [737, 372, 336, 352], "7": [1089, 437, 349, 249], "8": [82, 724, 206, 334], "9": [376, 745, 334, 294], "10": [728, 724, 350, 331], "11": [1093, 758, 339, 261]}, "anchors": [{"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}, {"x": 0.5, "y": 0.95}]},
 expanded:{variants:{low:'assets/world/buildings-expanded-low.webp',medium:'assets/world/buildings-expanded-medium.webp',high:'assets/world/buildings-expanded.webp'},columns:3,rows:2,anchors:[{x:.5,y:.94},{x:.5,y:.92},{x:.5,y:.92},{x:.5,y:.96},{x:.5,y:.94},{x:.5,y:.94}]},
 rig:{variants:{low:'assets/world/worker-rig-low.webp',medium:'assets/world/worker-rig-medium.webp',high:'assets/world/worker-rig.webp'},columns:3,rows:2},
 workers:{variants:{low:'assets/settlement/workers-low.webp',medium:'assets/settlement/workers-medium.webp',high:'assets/settlement/workers.webp'},columns:4,rows:2},
 equipment:{variants:{low:'assets/world/equipment-low.webp',medium:'assets/world/equipment-medium.webp',high:'assets/world/equipment.webp'},columns:4,rows:2,sourceWidth:1536,sourceHeight:1024,regions:{0:[0,0,414,512]}},
 props:{variants:{low:'assets/settlement/props-low.webp',medium:'assets/settlement/props-medium.webp',high:'assets/settlement/props.webp'},columns:4,rows:4},
 environment:{variants:{low:'assets/world/environment-overlays-low.webp',medium:'assets/world/environment-overlays-medium.webp',high:'assets/world/environment-overlays.webp'},columns:3,rows:2},
 navigation:{src:'assets/settlement/navigation-low.webp',columns:3,rows:1},
 journey:{src:'assets/settlement/journey-low.webp'},
 urban:{src:'assets/world/journey-urban.webp'},remote:{src:'assets/world/journey-remote.webp'},oral:{src:'assets/world/journey-oral.webp'},restricted:{src:'assets/world/journey-restricted.webp'},multilingual:{src:'assets/world/journey-multilingual.webp'},frontier:{src:'assets/world/journey-frontier.webp'},translation:{src:'assets/world/journey-translation.webp'},network:{src:'assets/world/journey-network.webp'},legacy:{src:'assets/world/journey-legacy.webp'}
},methods:{desk:0,copying:1,editorial:2,teaching:3,workshopCoord:4,reference:5,shared:6,translationPrep:7}};

window.WTTNEquipmentImages={desk:'assets/world/method-desk.webp',copying:'assets/world/method-copying.webp',editorial:'assets/world/method-editorial.webp',teaching:'assets/world/method-teaching.webp',workshopCoord:'assets/world/method-workshopCoord.webp',reference:'assets/world/method-reference.webp',shared:'assets/world/method-shared.webp',translationPrep:'assets/world/method-translationPrep.webp'};

window.WTTNSettlementArt.presentation={
 depth:'sort by ground contact; interior workers are composited between structure and equipment',
 occlusion:{footprint:{left:-.26,right:.26,top:-.39,bottom:-9},routes:'settlement-animation.js'},
 clips:['write','check','stack','teach','press','carry'],
 events:{construction:650,delivery:1700,equipment:1700,commission:1200,departure:1200,maxPending:12},
 dependencies:{terrain:[],expanded:['buildings-a','buildings-b'],rig:['workers'],equipment:['props']},
 fallback:'Every optional detail starts from an independently cached low-resolution visual. Missing art never disables HTML commands.'
};
