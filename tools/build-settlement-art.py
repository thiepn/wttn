"""Regenerate embedded reduced-resolution WebP artwork. Requires Pillow only."""
from pathlib import Path
from PIL import Image
import io, base64, json
ROOT = Path(__file__).resolve().parents[1]
fallback = {}
for file in sorted((ROOT / 'assets/settlement').glob('*.webp')):
    im = Image.open(file)
    im.thumbnail((768, 768))
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=72, method=4)
    fallback[file.stem] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
script = '/* Embedded reduced-resolution assets: no network is required to play. */\n(function(){const fallback=' + json.dumps(fallback,separators=(',',':')) + ';for(const [key,src] of Object.entries(fallback))if(window.WTTNSettlementArt.assets[key])window.WTTNSettlementArt.assets[key].fallback=src;for(const key of ["navigation","props"])document.documentElement.style.setProperty("--"+key+"-art",\'url("\'+fallback[key]+\'")\');})();\n'
(ROOT / 'settlement-fallbacks.js').write_text(script, encoding='utf-8')
