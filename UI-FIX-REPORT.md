# v2.10.1 UI and decoration repair

Verified 24 September 2026. This is a presentation patch to v2.10.0. Prices, production, purchasing rules, reset rewards and economic save schema remain unchanged.

## Fixed

- Building ledger icons are bounded, and responsive rows replace the oversized card layout. Counts, effects, costs and purchase actions have explicit layout space.
- Menu → Projects retains the Work / Projects / Stats / System tab strip. Selected tab text remains readable on hover and keyboard focus.
- Equipment actions use a full-width row below the illustration and description. Equip and Plan no longer collapse into narrow columns or create an oversized adjacent button. Already queued Methods show Planned.
- Phone sheets retain visible Place / Move / Remove actions outside the scrolling choices. Detail Close no longer floats over content or appears when no detail is open. Short landscape windows use a compact side sheet.
- Codex filters, utility actions and settings wrap without horizontal overflow. The phone theme selector has sufficient width.
- Feedback labels are measured and clamped, and hidden anchors no longer create clipped feedback at the viewport edge.
- Overview hides the inspector and frames all six sites. Selecting a building restores its inspector. Decoration previews use full-object camera framing and remain visible above phone sheets.
- New, aligned west and east garden artwork supplies clear ground rather than placing furniture on painted trees. High, medium, low and fallback scenes use the same courts. Ground layers no longer paint over decorations.
- All twelve decoration types have three approved locations, suitable scale and ground shadows. Collision checks use the whole projected object silhouette, plus delivery-route clearance. A placed object is not drawn twice under its preview.
- Known older cosmetic arrangements that conflict with the corrected locations recover every object at clear default sites. Unknown IDs and malformed placements are still rejected. Economic saves and progress-only import behavior are unchanged.

## Verification

| Check | Measured result |
|---|---|
| Existing release runner | 33 / 34 suites passed; timing exception below |
| New UI repair regression | 4 groups passed |
| Decoration geometry | All 36 locations clear buildings and routes; all defaults together and all three arrangements valid |
| Decoration UI actions | All 36 locations placed and removed through the running interface |
| Camera regression | 108 cases across desktop, phone and small-phone viewports passed |
| Responsive geometry | 22 screen/state checks, zero horizontal page/panel overflow or oversized controls |
| Economic parity | 628 identical snapshots, 4 approaches, 1h / 8h / 1d / 7d offline intervals; zero differences |
| Economic code identity | game-core.js, bignum.js and save-format.js byte-identical to v2.10.0 and the v2.9 baseline |
| Delivery checks | 15 groups passed, including relative paths and service-worker update behavior |
| Live update | Apply update saved and reloaded the production QA origin; all six 500-workforce counts retained |
| Final Overview | All six buildings visible; selecting Grand Library restores its inspector |

Live checks used the Codex Chromium in-app browser on Windows 11 (10.0.22631), AMD Ryzen 7 5800H, Node 24.16. Viewports included 1280×800, 390×844, 320×568 and 640×400. Tested Menu tabs, equipment, plans, target editing/focus retention, Codex, all five Journey categories, decoration placement and fresh-game hiring. Production-origin console inspection found no errors. The short-window check approximates the space constraints of zoom; it is not a claim of an actual 200% browser-zoom run.

### Existing offline timing failure

The 14-day offline simulation retains its original <5000 ms requirement. The final patched full run measured **6116 ms** and failed. An earlier patched run measured **4034 ms** and passed. The untouched v2.10.0 build measured **5521 ms** on the same host and also failed. No thresholds were relaxed, and the economic engine is unchanged. This variable startup-performance issue remains outstanding; it is separate from the repaired UI and decoration defects.

### Transfer budgets

Build `b0bc8edcdb3b042b`:

| Budget | Bytes | Limit |
|---|---:|---:|
| Initial playable | 3,601,695 | 5 MB |
| Detailed desktop scene | 8,529,311 | 12 MB |
| Detailed phone scene | 5,204,539 | 6 MB |
| Complete optimized art | 33,287,230 | 60 MB |

All transfer budgets passed. These are build measurements, not a fresh hardware FPS benchmark. Historical v2.10 frame-time captures remain in the source documentation and must not be represented as new patch measurements.

## Coverage limits

Physical Android/iOS, Firefox, Safari, an actual screen-reader session and a new-player study were unavailable. This patch does not certify full-campaign enjoyment or universal absence of bugs. Automated numeric, migration and save-integrity coverage was preserved; missing-art, offline and interrupted-update cases have automated coverage, while the new production update path was also exercised in the browser.

## Editable artwork and delivery

`art-source-v2.10.1/` contains the two native edited garden tiles, the aligned 3072×2048 terrain master, independent layers and prompt notes. `tools/prepare-v2101-art.py` re-encodes their responsive WebP variants with Pillow; the normal site build needs only Python's standard library. If regenerating the older art collection, apply this patch's art preparation afterward.

The web archive has index.html at its root and can be uploaded as a complete static site. The source archive includes the GitHub Pages workflow. See GITHUB-PAGES.md. No account deployment was performed. Existing local progress remains tied to its browser origin; use Full backup when moving to a new host.
