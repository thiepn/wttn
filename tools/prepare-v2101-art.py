"""Re-encode the supplied native garden master and editable terrain layers.
Requires Pillow. The normal web build does not require this optional art step.
"""
from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art-source-v2.10.1'
text=(ROOT/'crafted-assets.js').read_text(encoding='utf8')
start=text.index('Object.assign(window.WTTNSettlementArt.assets,')+len('Object.assign(window.WTTNSettlementArt.assets,')
manifest=json.loads(text[start:text.index(');',start)])
master=Image.open(ART/'terrain-gardens-3072.png').convert('RGB')
for quality,w,q in [('low',768,78),('medium',1536,84),('high',3072,89)]:
    image=master.resize((w,round(w*2/3)),Image.Resampling.LANCZOS)
    image.save(ROOT/manifest['terrain']['variants'][quality],quality=q,method=6)
    image.save(ROOT/f'assets/world/terrain-{quality}.webp',quality=q,method=6)
for key,spec in manifest.items():
    if not key.startswith('terrain-'):continue
    image=Image.open(ART/(key+'.png')).convert('RGBA')
    for quality,limit,q in [('low',768,70),('medium',1536,79),('high',3072,89)]:
        w=min(limit,image.width)
        image.resize((w,round(w*image.height/image.width)),Image.Resampling.LANCZOS).save(ROOT/spec['variants'][quality],quality=q,method=6)
print('Garden terrain and low-resolution fallbacks encoded. Run tools/build.py next.')
