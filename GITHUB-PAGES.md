# GitHub Pages

This repository publishes to https://thiepn.github.io/wttn/ through GitHub Actions. Each successful main-branch build runs the existing tests before deployment.

## Source workflow

1. Unzip the source archive and place the contents of `word-to-the-nations-v2.10.1` at your repository root, including `.github`, `.nojekyll`, `assets`, `tests` and `tools`.
2. In repository Settings → Pages, select **GitHub Actions** as the source.
3. Push to `main`, or run **Build and publish Word to the Nations** manually in Actions. If your default branch differs, update `.github/workflows/pages.yml`.
4. The workflow builds with Python, checks the economy/saves/presentation and uploads `dist/web` as a Pages artifact. The dependent deploy job has only the Pages/OIDC permissions it needs.
5. Visit the published URL online once. The playable shell can then start offline. Optional high-detail art is cached only as requested.

The workflow follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). No secret, API key or backend configuration is needed.

## Manual site upload

Unzip the **web** archive into the chosen publishing branch/root (or `/docs` folder) so `index.html`, `sw.js`, the hashed scripts/styles and `assets/` are adjacent. Choose that branch/folder in Settings → Pages. Do not upload only `index.html`, and do not use the source directory's unhashed `sw.js` as the deployed worker.

Relative URLs support both a root site and a repository path such as `/word-to-the-nations/`. HTTPS is required for service workers away from localhost. Do not add a leading slash to asset URLs or change the service-worker scope to the domain root.

## Updates and saves

Build and publish the complete output together. A new build has a distinct cache identifier. Its essential installation must finish before the UI offers Apply update. Applying saves first, then activates the waiting worker and reloads. Optional artwork has a separate cache and never blocks commands or saving.

Economic saves remain local to the same browser origin. Before moving to another domain/browser profile, use Export or Full backup and import on the destination. Full backup includes approved decoration locations; quality, motion and audio remain device-specific. Keep an external copy before a production update.

## Local preview

```sh
python tools/build.py
python -m http.server 8080 --directory dist/web
```

Open http://localhost:8080/. The web release is meant to be served over HTTP(S), not opened as a portable single file.
