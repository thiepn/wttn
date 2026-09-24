#!/usr/bin/env python3
"""Deterministic, dependency-free GitHub Pages web build. No portable generation."""
from pathlib import Path
import hashlib, json, re, shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist'
VERSION=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
def digest(data):return hashlib.sha256(data).hexdigest()
def build():
    if OUT.exists():
        if OUT.resolve()!=ROOT.resolve()/'dist':raise RuntimeError('Unsafe output path')
        shutil.rmtree(OUT)
    web=OUT/'web';web.mkdir(parents=True);mapping={};sizes={}
    def emit(name,data):
        path=Path(name);target=str(path.with_name(path.stem+'.'+digest(data)[:12]+path.suffix)).replace('\\','/')
        dest=web/target;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        mapping[name]=target;sizes[target]=len(data);return target
    for folder in ['assets/settlement','assets/world','assets/ui','assets/fonts','icons']:
        for p in sorted((ROOT/folder).rglob('*')):
            if p.is_file() and p.suffix.lower() in ['.webp','.woff2','.ttf','.svg','.png']:emit(p.relative_to(ROOT).as_posix(),p.read_bytes())
            elif p.is_file() and ('LICENSE' in p.name or 'OFL' in p.name):
                dest=web/p.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
    def rewrite(text):
        for a,b in sorted(mapping.items(),key=lambda x:-len(x[0])):text=text.replace(a,b)
        return text
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    names=re.findall(r'<script src="([^"]+)"',html)+re.findall(r'<link rel="stylesheet" href="([^"]+)"',html)
    for name in names:emit(name,rewrite((ROOT/name).read_text(encoding='utf-8')).encode())
    html=rewrite(html);(web/'index.html').write_text(html,encoding='utf-8')
    (web/'manifest.webmanifest').write_text(rewrite((ROOT/'manifest.webmanifest').read_text(encoding='utf-8')),encoding='utf-8')
    for name in ['.nojekyll','PRIVACY.md']:shutil.copy2(ROOT/name,web/name)
    essential=['./','./index.html','./manifest.webmanifest']+['./'+mapping[n] for n in names]
    fallback_names={'terrain','buildings-a','buildings-b','props','workers','decorations','equipment','navigation','journey','worker-variants','work-props','environment-activity','milestones','campaign-keepsakes'}
    for source,target in mapping.items():
        low_fallback='-low.' in source and (Path(source).stem.removesuffix('-low') in fallback_names or source.startswith('assets/world/crafted/terrain-'))
        if low_fallback or (source.startswith('assets/ui/') and not source.endswith('interface-kit.webp')) or source.startswith('assets/fonts/') or source.startswith('icons/'):essential.append('./'+target)
    build_id=digest((''.join(mapping.values())+html).encode())[:16]
    sw=(ROOT/'sw.js').read_text(encoding='utf-8').replace('__BUILD_ID__',build_id).replace('/*__ESSENTIAL__*/[]',json.dumps(essential)).replace('/*__ASSETS__*/[]',json.dumps(['./'+v for k,v in mapping.items() if k.startswith('assets/')]))
    (web/'sw.js').write_text(sw,encoding='utf-8')
    essential_bytes=sum((web/x[2:]).stat().st_size for x in essential if x not in ['./','./index.html'])+(web/'index.html').stat().st_size
    report={'version':VERSION,'buildId':build_id,'initialPlayableBytes':essential_bytes,'artworkBytes':sum(v for k,v in sizes.items() if k.endswith('.webp')),'assets':mapping,'files':{p.relative_to(web).as_posix():digest(p.read_bytes()) for p in sorted(web.rglob('*')) if p.is_file()}}
    (OUT/'build-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    if essential_bytes>5_000_000:raise RuntimeError('Initial playable budget exceeded: '+str(essential_bytes))
    if report['artworkBytes']>60_000_000:raise RuntimeError('Artwork budget exceeded')
    print(f'Built v{VERSION} ({build_id}): initial {essential_bytes:,} bytes; art {report["artworkBytes"]:,} bytes. Web only.')
if __name__=='__main__':build()
