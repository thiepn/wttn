"""HTTP delivery verification; does not replace browser navigation/installation."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from threading import Thread
import tempfile, shutil, requests, json, hashlib
root=Path(__file__).resolve().parents[1]; out=Path(__file__).resolve().parents[1] / 'qa-evidence'
out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as directory:
    stage=Path(directory)
    shutil.copytree(root/'dist/web',stage,dirs_exist_ok=True)
    shutil.copytree(root/'dist/web',stage/'games/wttn')
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=directory))
    Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}'; results=[]
    for scope in ['/', '/games/wttn/']:
        for f in ['','index.html','manifest.webmanifest','sw.js','icons/icon-32.png','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/icon.svg']:
            r=requests.get(base+scope+f,timeout=5); expected=(root/'dist/web'/(f or 'index.html')).read_bytes()
            assert r.status_code==200 and r.content==expected,(scope,f,r.status_code)
            results.append({'path':scope+f,'status':r.status_code,'bytes':len(r.content),'contentType':r.headers['Content-Type'],'sha256':hashlib.sha256(r.content).hexdigest()})
    server.shutdown()
(out/'http-results.json').write_text(json.dumps({'passed':len(results),'failed':0,'method':'Python HTTP server + HTTP client, byte-for-byte delivery; no browser navigation','requests':results},indent=2))
print(f'{len(results)} HTTP paths pass, root and subdirectory. Not a browser/PWA test.')
