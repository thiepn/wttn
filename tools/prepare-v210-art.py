"""Reproducible sprite packing/encoding. Native generated masters remain editable.

Requires Pillow and NumPy only for art preparation, not the normal web build.
Usage: python tools/prepare-v210-art.py --source ../art-source-v210
"""
from pathlib import Path
import argparse, json, hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=ROOT.parent/'art-source-v210')
args = parser.parse_args()
ART = args.source.resolve()
OUT = ROOT/'assets/world/crafted'
OUT.mkdir(parents=True, exist_ok=True)
manifest = {}
method_images={}
commission_images={}
cache_path=OUT/'.encode-cache.json'
cache=json.loads(cache_path.read_text()) if cache_path.exists() else {}

def encode(name, im, widths=(384,768,1536), quality=86):
    variants = {}
    fingerprint=hashlib.sha256(im.tobytes()+str((im.size,widths,quality)).encode()).hexdigest()
    for level, width in zip(('low','medium','high'), widths):
        path = OUT/f'{name}-{level}.webp'
        variants[level] = path.relative_to(ROOT).as_posix()
        if cache.get(name)==fingerprint and path.exists():continue
        out = im.copy()
        out.thumbnail((width, int(width*im.height/im.width)), Image.Resampling.LANCZOS)
        out.save(path, 'WEBP', quality=quality if level=='high' else 79 if level=='medium' else 67, method=4)
    cache[name]=fingerprint
    return {'variants':variants,'sourceWidth':im.width,'sourceHeight':im.height}

for name in ('scribe','copyist','editor','teacher','workshop','scriptorium'):
    source = ART/f'{name}-stages.png'
    metadata = ART/f'{name}-stages-crops.json'
    if not source.exists() or not metadata.exists(): continue
    im = Image.open(source).convert('RGBA')
    data = json.loads(metadata.read_text(encoding='utf-8-sig'))
    crops = data['crops']
    stage_names=['surveyed','established','expanded','developed']
    spec = dict(stages=['building-'+name+'-'+str(i) for i in range(4)],stageNames=stage_names,
        contactShadow={'rx':.30,'ry':.065,'opacity':.17},
        footprint={'left':-.26,'right':.26,'top':-.39,'bottom':-9},
        doorway={'x':.12,'y':-.04},
        equipmentAnchor={'x':.22,'y':.01},
        workstationSockets=[{'x':.02,'y':.07},{'x':.17,'y':.09}],
        fallback='buildings-a' if name in ('scribe','copyist','editor') else 'buildings-b')
    manifest['building-'+name] = spec
    for i,(x,y,w,h) in enumerate(crops):
        stage=im.crop((x,y,x+w,y+h))
        stage_key=spec['stages'][i]
        encoded=encode(stage_key,stage,(192,384,w),87)
        encoded.update(columns=1,rows=1,regions={'0':[0,0,w,h]},anchors=[{'x':.5,'y':.97}],stageName=stage_names[i],fallback=spec['fallback'])
        manifest[stage_key]=encoded
        editable=ART/'buildings'/name
        editable.mkdir(parents=True,exist_ok=True)
        stage.save(editable/(stage_names[i]+'.png'))
        # Separate mechanical alpha masks are editable and share the sprite anchor.
        # Outdoor routes do not need them; doorway scenes can opt into occlusion.
        foreground=stage.copy()
        alpha=foreground.getchannel('A');alpha.paste(0,(0,0,w,int(h*.76)))
        foreground.putalpha(alpha);foreground.save(editable/(stage_names[i]+'-foreground-mask.png'))
        doorway=Image.new('L',stage.size)
        from PIL import ImageDraw
        ImageDraw.Draw(doorway).rectangle((int(w*.46),int(h*.56),int(w*.68),int(h*.91)),fill=255)
        doorway.save(editable/(stage_names[i]+'-doorway-mask.png'))
        encoded['masks']={'foreground':{'normalizedRect':[0,.76,1,.24],'source':f'buildings/{name}/{stage_names[i]}-foreground-mask.png'},'doorway':{'normalizedRect':[.46,.56,.22,.35],'source':f'buildings/{name}/{stage_names[i]}-doorway-mask.png'},'usage':'Outdoor workstations are in front. Masks are applied only to explicitly authored interior actors.'}

terrain = ART/'terrain-native-3072.png'
if terrain.exists():
    im=Image.open(terrain).convert('RGB')
    manifest['terrain']=encode('terrain',im,(768,1536,3072),89)
    manifest['terrain']['nativeDetailTiles']=4
    for layer in json.loads((ART/'layers/layers.json').read_text(encoding='utf-8')):
        p=ART/'layers'/layer['source']
        im=Image.open(p).convert('RGBA')
        spec=encode(p.stem,im,(max(256,int(im.width/4)),max(384,int(im.width/2)),im.width),87)
        spec.update(worldRect=layer['rect'],drawAfterBuildings=layer['drawAfterBuildings'])
        manifest[p.stem]=spec
    manifest['terrain']['layerKeys']=[k for k in manifest if k.startswith('terrain-')]

for source in sorted(ART.glob('journey-*.png')):
    if 'reference' in source.stem: continue
    manifest[source.stem.removeprefix('journey-')]=encode(source.stem,Image.open(source).convert('RGB'),(384,768,1536),87)

for name,columns,rows in [('equipment',4,2),('commissions',3,1),('worker-variants',6,3),('navigation',3,1),('milestones',6,4),('environment-activity',3,2),('work-props',3,2),('campaign-keepsakes',3,2)]:
    source=ART/f'{name}.png'
    if not source.exists():continue
    spec=encode(name,Image.open(source).convert('RGBA'))
    spec.update(columns=columns,rows=rows)
    metadata=ART/f'{name}-crops.json'
    if metadata.exists():spec['regions']={str(i):b for i,b in enumerate(json.loads(metadata.read_text(encoding='utf-8-sig'))['crops'])}
    manifest[name]=spec
    if name=='equipment':
        im=Image.open(source).convert('RGBA')
        for i,method in enumerate(['desk','copying','editorial','teaching','workshopCoord','reference','shared','translationPrep']):
            box=spec.get('regions',{}).get(str(i),[i%4*im.width/4,i//4*im.height/2,im.width/4,im.height/2])
            x,y,w,h=box;thumb=im.crop((x,y,x+w,y+h));thumb.thumbnail((320,320))
            path=OUT/f'method-{method}.webp';thumb.save(path,'WEBP',quality=84,method=4)
            method_images[method]=path.relative_to(ROOT).as_posix()
    if name=='commissions':
        im=Image.open(source).convert('RGBA')
        for i,id in enumerate(['manuscript','reference','teaching']):
            x,y,w,h=spec['regions'][str(i)];thumb=im.crop((x,y,x+w,y+h));thumb.thumbnail((480,360))
            path=OUT/f'commission-{id}.webp';thumb.save(path,'WEBP',quality=86,method=4)
            commission_images[id]=path.relative_to(ROOT).as_posix()

(ART/'optimized-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
script='/* Native-detail artwork; reproducible via tools/prepare-v210-art.py. */\nwindow.WTTNSettlementArt.assets["fallback-terrain"]=window.WTTNSettlementArt.assets.terrain;\nObject.assign(window.WTTNSettlementArt.assets,'+json.dumps(manifest,separators=(',',':'))+');\nObject.assign(window.WTTNEquipmentImages,'+json.dumps(method_images,separators=(',',':'))+');\nwindow.WTTNCommissionImages='+json.dumps(commission_images,separators=(',',':'))+';\n'
if 'navigation' in manifest:script+='if(typeof document!=="undefined")document.documentElement.style.setProperty("--navigation-art",\'url("'+manifest['navigation']['variants']['low']+'")\');\n'
(ROOT/'crafted-assets.js').write_text(script,encoding='utf-8')
cache_path.write_text(json.dumps(cache,indent=2))
print('Prepared',len(manifest),'asset families; masters:',ART)
