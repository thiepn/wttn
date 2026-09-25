# Word to the Nations — v2.10.3

[Play Word to the Nations](https://thiepn.dev/wttn/) · [Deployment status](https://github.com/thiepn/wttn/actions/workflows/pages.yml)

v2.10.3 removes an obsolete, higher-specificity save-warning rule that combined with the new layout to create a clipped brown column. The warning now has one layout definition, stays inside desktop and phone viewports, and keeps Export and Retry accessible. Storage-failure and save-integrity behavior is unchanged.

v2.10.2 fixes misleading save warnings: it verifies the actual save by reading it back, removes the redundant storage probe, distinguishes save preparation from storage failures, and offers Retry saving and Export progress when needed. Run `npm run test:saving` for the regression cases. No economic formulas, storage keys or save formats changed.

The preceding UI patch repaired oversized ledger icons, disappearing Projects navigation, cramped equipment buttons, phone/landscape sheets, decoration placement and overview framing. See [the v2.10.1 repair report](UI-FIX-REPORT.md). The original v2.10 documents below describe the larger visual release; their older performance captures are not new measurements for this patch.

Run `npm run test:ui-repairs` for the new placement, framing, appearance-recovery and economic-identity regressions. The final full run passed 33 of 34 existing suites; the pre-existing 14-day offline timing test remained variable and failed its unchanged five-second limit on both the original and patched builds.

A living Mediterranean Scripture settlement. This web-only visual update adds native-detail layered scenery, 24 separate building stages, independent worker routines, clearer decision screens and portable decoration arrangements. The economy and schema-8 save format remain byte-identical to v2.9.

## Build and play

Python 3 builds the static site; Node 18+ runs tests. No npm packages, backend, accounts, API keys or remote fonts are required.

```sh
python tools/build.py
python -m http.server 8080 --directory dist/web
```

Open http://localhost:8080/. Serve from the source root with `--directory` so the build can safely replace `dist` on Windows. The normal game advances automatically. `?smoke=1` is a QA-only mode that pauses economic ticks and service-worker registration; do not use it as the public play URL.

```sh
npm test
npm run test:visual
```

`node tools/run-release-tests.cjs` runs all 34 suites, saves individual logs and returns a failure status if any suite fails. `npm run test:sessions` retains the scheduled-session simulator. This visual update does not alter its balance assumptions.

## Distribution

`dist/web` is the deployable site. Its paths are relative, scripts/styles/art are content-hashed, and the service worker has a build-specific identifier. Essential fallbacks work without detailed artwork. See [GitHub Pages instructions](GITHUB-PAGES.md). No deployment was performed for this delivery.

The previous portable edition remains a separate, older download. v2.10 produces no portable HTML. Saves do not automatically follow a browser profile or origin: use Export/Import when moving to a different URL.

## Saves and appearance

The economic key remains `wttn.phase6.save.v6`, using schema 8 inside the unchanged checksummed envelope. Existing schema-6/7 migrations and the one-time Buy Max compatibility credit remain unchanged. The pre-migration backup is preserved.

Normal Export is still a progress-only envelope. Full backup wraps that exact envelope plus validated decoration placements. It excludes device quality, motion and audio. Progress-only imports leave local arrangements unchanged. Full imports validate both parts before changing storage and keep an interrupted-import recovery journal.

## Editable presentation

- `settlement-model.js`: current activity and retained visual milestones.
- `presentation-disclosure.js`, `secondary-screens.js`: shared truthful purchase, Reference, commission and reset disclosure.
- `appearance-model.js`, `full-backup.js`: 36 approved locations, collision checks and portable appearance.
- `settlement-clips.js`, `settlement-animation.js`, `worker-painter.js`: reusable rigs, routines, routes and role props.
- `settlement-scene.js`, `settlement-painter.js`, `journey-presentation.js`: camera, depth ordering and rendering.
- `asset-loader.js`, `crafted-assets.js`: three-download queue, negative caching, responsive assets and decoded-image budget.

The separate editable-art archive contains PNG masters, terrain tiles/layers, measured crop JSON, prompts and animation sources. The ordinary build uses included optimized assets. To re-encode edited masters, install Pillow and NumPy, unpack the archive beside the source, then run `python tools/prepare-v210-art.py --source ../art-source-v210` before building. See [art specification](ART-SPEC.md).

## Verification status

All 34 automated suites passed. UI actions, offline startup, corrupt/missing art, root/subdirectory hosting and responsive views were exercised locally. See [measured verification](VERIFICATION.md), [visual QA](design-qa.md) and [release notes](RELEASE_NOTES.md). Physical mobile, Firefox/Safari, real assistive-technology users, verified browser 200% zoom, multi-touch and the five-player study remain outstanding. No numerical beauty or campaign-enjoyment claim is made.
