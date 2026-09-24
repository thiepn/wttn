#!/usr/bin/env python3
"""Rebuild the artwork manifest from shipped WebP assets; no network required."""
from pathlib import Path
import base64,json
root=Path(__file__).resolve().parents[1]
manifest={}
for name in ['copying','workshop','translation','network','field','legacy','atlas']:
    record={}
    for size in ['fallback','small','large']:
        p=root/'assets'/'workshop'/f'{name}-{size}.webp'
        record[size]='data:image/webp;base64,'+base64.b64encode(p.read_bytes()).decode() if size=='fallback' else 'assets/workshop/'+p.name
        if size!='fallback':record[size+'Bytes']=p.stat().st_size
    manifest[name]=record
(root/'art-manifest.js').write_text('/* Generated art with embedded low-resolution offline fallbacks. */\nwindow.WTTNArtManifest='+json.dumps(manifest,separators=(',',':'))+';\n',encoding='utf-8')
