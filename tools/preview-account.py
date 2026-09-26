"""Local-only account preview. Never included in the static build.

Use --sdk <downloaded canonical SDK> to preview the shared SDK on localhost.
Without it, the account UI exercises its unavailable-service state.
"""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8796)
parser.add_argument('--sdk', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'dist' / 'web'

class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] == '/account-platform/sdk/v1/index.js' and args.sdk:
            body = args.sdk.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

ThreadingHTTPServer(('127.0.0.1', args.port), partial(Preview, directory=str(root))).serve_forever()
