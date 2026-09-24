"""Pack four native-detail tiles, preserve seam guides and export editable layers.

This is mechanical registration/packing of generated art, not procedural scenery.
Every tile is 1536×1024 native generated artwork. Only a narrow 24-pixel seam guide
uses the shared composition master, avoiding hard boundaries between tile renders.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse, json
import numpy as np
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[2]/'art-source-v210')
args=parser.parse_args();root=args.source
base=Image.open(root/'terrain-master.png').convert('RGB').resize((3072,2048),Image.Resampling.LANCZOS)
canvas=base.copy();tile_records=[]
for name,x,y in [('nw',0,0),('ne',1536,0),('sw',0,1024),('se',1536,1024)]:
    tile=Image.open(root/f'terrain-{name}-detail.png').convert('RGB')
    assert tile.size==(1536,1024),f'{name}: native tile dimensions changed'
    yy,xx=np.mgrid[0:1024,0:1536]
    # Outer landscape edges use full native art. Only shared tile edges blend.
    horizontal=1535-xx if x==0 else xx
    vertical=1023-yy if y==0 else yy
    alpha=np.clip(np.minimum(horizontal,vertical)/24,0,1)
    mask=Image.fromarray((alpha*255).astype('uint8'))
    canvas.paste(tile,(x,y),mask)
    tile_records.append({'source':f'terrain-{name}-detail.png','nativeSize':[1536,1024],'position':[x,y],'seamGuidePixels':24})
canvas.save(root/'terrain-native-3072.png')
out=root/'layers';out.mkdir(exist_ok=True)
w,h=canvas.size;rgb=np.asarray(canvas);yy,xx=np.mgrid[:h,:w]
# Non-overlapping, editable masks preserve every pixel of the registered artwork.
sky=Image.new('L',(w,h));ImageDraw.Draw(sky).polygon([(0,0),(w,0),(w,494),(2820,485),(2530,472),(2280,464),(1980,452),(1650,436),(1380,330),(1180,265),(965,245),(765,207),(580,145),(400,130),(225,80),(0,10)],fill=255)
sky=np.asarray(sky)>0
water=(rgb[:,:,2].astype(float)>rgb[:,:,0]*1.35)&(rgb[:,:,2].astype(float)>rgb[:,:,1]*1.04)&(yy>490)&(yy<1200)&(xx>1230)&~sky
foreground=Image.new('L',(w,h));ImageDraw.Draw(foreground).polygon([(0,1410),(370,1520),(600,1760),(1180,1920),(1520,2048),(1880,1810),(2390,1630),(2810,1420),(3072,1410),(3072,2048),(0,2048)],fill=255)
foreground=np.asarray(foreground)>0
terraces=(yy>720)&~water&~foreground&~sky
coast=~(sky|water|foreground|terraces)
records=[]
for name,mask in [('sky',sky),('coast',coast),('water',water),('terraces',terraces),('foreground',foreground)]:
    layer=canvas.convert('RGBA');layer.putalpha(Image.fromarray((mask*255).astype('uint8')))
    box=layer.getbbox();cropped=layer.crop(box);filename=f'terrain-{name}.png';cropped.save(out/filename)
    records.append({'id':'terrain-'+name,'source':filename,'rect':[box[0]/w,box[1]/h,(box[2]-box[0])/w,(box[3]-box[1])/h],'nativeBounds':list(box),'drawAfterBuildings':name=='foreground'})
(out/'layers.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
(root/'terrain-assembly.json').write_text(json.dumps({'workingSize':[w,h],'tiles':tile_records,'layers':records,'note':'New native tile detail; 24px shared-master seam registration strips only.'},indent=2),encoding='utf-8')
print('Assembled native 3072×2048 terrain and',len(records),'editable layers')
