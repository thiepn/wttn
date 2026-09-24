# v2.10.0 measured verification

Date: 24 September 2026. Build `e45907ed29f308b1`. This is a visual-update verification report, not certification of campaign enjoyment or full release readiness.

## Automated checks

- **34/34 suites passed** in `docs/qa-v2.10/full-test-results.json`; individual outputs are retained in `logs/`.
- `game-core.js`, `bignum.js`, `save-format.js` match v2.9 byte for byte. Four exact traces (no approach, Scholar, Publisher, Teacher) compared **628 state snapshots with zero differences**, including resets, planned purchasing and offline intervals of 1h, 8h, 1d and 7d.
- Existing numeric, security, integrity, schema-6/7 migration, repeated import and one-time compatibility-credit checks pass. Existing live/offline queue comparisons pass for all four intervals.
- Ten new groups cover Reference ownership, authoritative contribution sums, commission comparisons, truthful inactive state, 36 placement locations/collisions, full-backup validation/transaction recovery, objective priority and all role routes. Worker paths were sampled every 250 ms over 120 seconds; no sampled point entered the defined solid footprints.
- Three asset-manager groups cover concurrency, failure caching and memory eviction. Fifteen delivery checks verify hashes, syntax, relative dependencies, root/subdirectory paths, atomic essential installation, saved update activation, offline shell lookup and optional-art isolation.
- The last focused rerun after final presentation fixes passed the v2.10, static-ID, accessibility-contract and delivery suites. Earlier stale version/source-location assertions were updated for the intentional renderer split; the 18 KB scene-controller and 5-second offline thresholds were retained.

## Running-game checks

Tested in Codex's embedded Chromium browser on Windows 11 build 22631, AMD Ryzen 7 5800H. The test surface does not expose an exact Chromium build or GPU allocation profile. All saves used for QA were synthetic fixtures on separate loopback ports; the user's original localhost:8780 tab/save was preserved.

- All six first-building actions and all eight Method buttons were clicked; a normal exported save confirmed exactly one of each producer and Method. Hiring, quantity controls, plan sections, scene selection, commission/Reference disclosure, Codex search/theme/bookmark surfaces and Journey categories were inspected.
- Full backup exported and restored the eastern pergola location. A bad checksum was rejected before confirmation; progress-only import changed the economic fixture while leaving that location intact. The repeated import then restored both parts. Storage-failure atomicity uses unit fault injection, not an actual exhausted browser disk.
- The actual campaign-completion action showed one finale dialog, and closing it returned to Settlement with focus on Building list. A real core Translation fixture retained its architecture and ten starting Scribes; other buildings had no workers/operating equipment.
- Matched economic fixtures captured opening, selected Library, developed settlement, post-reset, commissions, Translation/Network/Fields/Legacy, Codex, decoration controls and campaign completion. Desktop pairs are 1536×1024; phone pairs are 390×844. Phone overview uses the same selected Scribe and all twelve default decorations in both releases. Reference compositions are direction studies with different labels/progress, not pixel-exact UI specifications.
- Responsive checks: 1536×1024, 1280×720/800, 390×844 and 320×568. At 320×568 there was no document horizontal overflow; keyboard activation in the building list returned focus to the enabled Hire action. Reduced motion and Low quality rendered six fixed representative workers. The accessibility tree exposes buildings, costs, actions and dialog labels; this does not replace a screen-reader user test.
- A custom local server returned missing Scribe artwork and corrupt worker detail. Gameplay continued with fallbacks, and a purchase increased Scribes from 50 to 51. Each failing URL was requested once across repeated renders. No repeated download storm occurred.
- A second path delayed each artwork response by 350 ms; commands and keyboard selection remained usable. This is an artificial latency exercise, not a calibrated bandwidth/mobile network benchmark.
- Root hosting and `/offline/`, `/fault/`, `/slow/` subdirectories were exercised. The real service worker reported Offline shell active. With its server stopped, reload succeeded and a further hire increased Scribes from 51 to 52. Interrupted-update installation and save-before-activation are executable worker mocks; a real interrupted production deployment remains unperformed.

## Budgets and performance

| Measurement | Result | Budget |
|---|---:|---:|
| Initial playable assets | 3,529,653 bytes | 5 MB |
| Detailed desktop scene, conservative sum | 8,342,335 bytes | 12 MB |
| Detailed phone scene, conservative sum | 5,039,747 bytes | 6 MB |
| Complete optimized artwork | 32,109,196 bytes | 60 MB |
| Maximum desktop tracked decoded image pool | 95,550,044 bytes / 91.1 MiB | 96 MiB |
| Phone viewport tracked decoded pool | 38,806,576 bytes / 37.0 MiB | 48 MiB |
| Low phone viewport tracked decoded pool | 32,522,248 bytes / 31.0 MiB | 48 MiB |

The scene byte estimates include essential fallbacks plus every current developed-site upgrade, even offscreen sites. Initial transfer is a conservative uncompressed asset-file sum, not a measured network HAR. Image residency counts managed image dimensions ×4; browser, CSS texture, compositor and GPU caches are outside that counter.

| Local rendering sample | Workers | Cadence | Mean draw | p95 draw |
|---|---:|---:|---:|---:|
| Developed desktop | 24 | 59.94 FPS | 3.05 ms | 4.20 ms |
| Maximal 500-workforce scene, 12 decorations, isolated QA tabs | 24 | 59.94 FPS | 3.21 ms | 4.90 ms |
| Same scene while several QA tabs were active | 24 | 35.87 FPS | 2.69 ms | 4.20 ms |
| 390×844 viewport on this desktop | 12 | 59.44 FPS | 1.34 ms | 2.20 ms |

Cadence uses the latest 240 animation intervals; draw timings use renderer counters. These are local samples, not a GPU benchmark or a physical-phone claim. The separate Low/reduced-motion capture shows six workers and intentionally stops continuous rendering.

## Existing offline timing failure

The unchanged v2.9 benchmark previously took 5.164–5.669 seconds under concurrent work, exceeding its 5-second 14-day threshold, and 4.799 seconds in its final isolated run. The final v2.10 full-suite sample simulated 14 days in **2,914 ms**; the threshold remains 5,000 ms. The economy/simulation code is byte-identical, so this is not evidence of an offline-engine fix. Host-load sensitivity remains a known benchmark limitation. Historical logs are retained in `docs/qa-v2.9`.

## Outstanding coverage

Firefox, Safari, physical Android/iOS, real multi-touch/pinch, real screen-reader users and the five-player opening/return study were unavailable. Browser zoom shortcuts did not change the embedded test viewport; **200% browser zoom is not verified**. Narrow CSS viewport and text-scale checks are not presented as equivalent coverage. GPU/process-wide memory and real interrupted deployment testing remain outstanding.

Five players should each establish a building, equip a Method, create a plan, return after a gap and explain the first reset; at least four must independently identify the next action and the visible result. Record engagement and visual preference separately. No player results have been fabricated. Automated simulations do not prove campaign fun, a 14–21-day enjoyable experience, or a numerical aesthetic improvement.

## Evidence

Raw JSON/logs and HTTP fault counts are under `docs/qa-v2.10`; screenshot pairs and comparison boards are delivered separately. `gameplay-walkthrough.mp4` contains 98 actual captured frames over about 21 seconds, encoded at 30 FPS with duplicate frames. It cuts from a funded opening fixture to a developed fixture and is not an FPS demonstration. No production deployment was made.
