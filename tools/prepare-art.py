"""Encode edited PNG masters into web variants. Optional dependency: Pillow.

python tools/prepare-art.py --masters ../editable-art/masters-v28 --settlement-masters ../editable-art/masters-v29
The normal site build uses the checked-in WebP files and needs no Pillow.
"""
from pathlib import Path
from PIL import Image
import argparse,json

p=argparse.ArgumentParser();p.add_argument('--masters',type=Path,required=True);p.add_argument('--settlement-masters',type=Path,required=True,help='v2.9 extended terrain and decoration masters')
a=p.parse_args();root=Path(__file__).resolve().parents[1]
world=root/'assets/world';ui=root/'assets/ui'
def encode(im,dest,size,quality=86):
    dest.parent.mkdir(parents=True,exist_ok=True)
    im.resize(size,Image.Resampling.LANCZOS).save(dest,'WEBP',quality=quality,method=6)
terrain=Image.open(a.masters/'terrain-master.png').convert('RGB')
for name,size,q in [('low',(768,512),74),('medium',(1536,1024),84),('high',(3072,2048),88)]:
    encode(terrain,world/f'terrain-{name}.webp',size,q)
for name in ['buildings-expanded','equipment','environment-overlays','worker-rig']:
    im=Image.open(a.masters/f'{name}.png').convert('RGBA')
    for suffix,size,q in [('-low',(768,512),74),('-medium',(1024,683),82),('',(1536,1024),88)]:
        encode(im,world/f'{name}{suffix}.webp',size,q)
im=Image.open(a.masters/'journey-scenes.png').convert('RGB')
names=['urban','remote','oral','restricted','multilingual','frontier','translation','network','legacy']
for i,name in enumerate(names):
    x,y=i%3*418,i//3*418
    encode(im.crop((x,y,x+418,y+418)),world/f'journey-{name}.webp',(418,418),88)
im=Image.open(a.masters/'equipment.png').convert('RGBA')
for i,name in enumerate(['desk','copying','editorial','teaching','workshopCoord','reference','shared','translationPrep']):
    x,y=i%4*384,i//4*512;w=414 if i==0 else 384
    encode(im.crop((x,y,x+w,y+512)),world/f'method-{name}.webp',(192,round(512*192/w)),88)
im=Image.open(a.masters/'interface-kit.png').convert('RGBA')
for name,meta in json.loads((a.masters/'interface-kit-crops.json').read_text()).items():
    encode(im.crop(meta['sourceBox']),ui/f'{name}.webp',tuple(meta['size']),88)
print('Edited masters encoded. Rebuild with python tools/build.py and rerun visual/budget checks.')

# The continuation deliberately uses its recorded world transform; do not put
# the old cropped terrain into the new world bounds.
for key,source,widths in [('terrain','terrain-extended.png',[768,1536,3072]),('decorations','decorations.png',[724,1086,1448])]:
    im=Image.open(a.settlement_masters/source)
    for level,w in zip(['low','medium','high'],widths):
        encode(im,world/f'{key}-{level}.webp',(w,round(im.height*w/im.width)),76 if level=='low' else 84)
