# v2.10 visual comparison

final result: passed

Scope: the implemented desktop/phone/Journey direction and supported local views. This is not a statement that unavailable device, player, screen-reader or browser tests passed.

## Comparison evidence

Source visual truth: editable-art `reference-desktop.png` (1536×1024), `reference-phone.png` (1024×1536) and `reference-journey.png` (1536×1024). Implemented views: screenshot package `matched/v210-developed.png`, `matched/v210-phone.png`, `matched/v210-translation.png`. Baseline counterparts are paired with identical economic fixtures and viewport sizes.

Combined inputs opened and reviewed: `final-desktop-comparison.jpg`, `final-phone-comparison.jpg`, `final-journey-comparison.jpg`, `inspector-detail-comparison.jpg`, `secondary-interface-review.jpg` and `journey-art-review.jpg`. Desktop source/implementation are 1536×1024, displayed at the same scale. The phone direction study is aspect-fitted with padding beside actual 390×844 CSS/pixel captures; it has different labels and progression and is not used for pixel-difference scoring. Browser chrome is excluded. Library inspector crops keep purchase typography readable at larger scale.

## Findings and resolved iterations

- P1 resolved: narrow-screen Overview previously enlarged the village so only a few sites were visible. The new safe world region frames all six between the journal and sheet. Evidence: matched phone pair and `stage2-phone-overview.png`.
- P2 resolved: close zoom could place a selected roof behind the journal. Zoom now reframes the selected site within the measured safe region. Evidence: `stage2-close-framed.png`.
- P2 resolved: Journey's old narrow dark sidebar and nested scrolling reduced art and decision space. A larger illustration, compact destination grid and one phone scrolling surface replace them. Evidence: Journey comparison and `phone-journey.png`.
- P2 resolved: Library milestone text implied a higher producer where none exists. The shared disclosure explains the actual relationship and places optional Reference access below essential purchasing. Evidence: inspector crop comparison.
- P2 resolved: the decoration catalog pushed placement actions down a long sheet. It is now a disclosure below location/Place/Move/Remove, with a visible preview and accessible alternative to world markers. Evidence: decoration captures and 320-pixel live check.
- P1 resolved during release checks: a scene refactor removed the live marker-choice variable, interrupting frame completion. Restored the bounded list; final live frame counters, worker animation, placement checks and approximately 60 FPS sample confirm recovery. This is a runtime fix, not counted as an aesthetic iteration.

No unresolved P0/P1/P2 visual mismatch was observed in the compared supported states. Reference illustrations deliberately use more cutaway architecture and invented labels; the implementation uses clean roofed assets with separately animated outdoor workers and preserves the six real authored coordinates. Those differences are intentional.

## Required fidelity surfaces

- **Typography:** Alegreya display hierarchy and Source Sans 3 controls are retained and self-hosted. Long Library/currency values remain legible; exact cost and next benefit are visible. Reading is kept within a comfortable measure. Real HTML text replaces all generated reference labels.
- **Spacing/layout:** compact floating surfaces leave scenery open; the purchase header remains separate from expanded detail. The phone uses a compact/expanded/detail sheet. The illustrated Journey and three commissions provide distinct screen structures rather than repeated dashboard cards.
- **Colors/tokens:** warm parchment, terracotta commitments and ink text remain consistent. No opaque full-width green top/bottom bars. Focus, disabled and selected states have borders/text treatment in addition to color.
- **Image quality:** native-detail terrain tiles replace enlargement; 24 measured building crops preserve aspect ratio and avoid atlas clipping. New Method, commission, milestone, Journey and medallion raster assets share materials/light direction. Fallbacks are intentional low-detail assets, not substitutes for completed high-detail art.
- **Copy/content:** Reference disclosure, the Library milestone, reset retention, units, completed investment, queue assumptions and post-reset priorities are now explicit. Generated mockup numbers are never treated as authoritative.

## Follow-up polish / open coverage

P3: physical-device and player preference testing may suggest a quieter density for very late settlements or larger worker silhouettes. These are subjective refinements, not unobserved guarantees. Doorway crop masks are supplied for future authoring; current routines stay outdoors. Real assistive-technology, touch, 200% zoom and non-Chromium coverage remain open as listed in VERIFICATION.md.

## Implementation checklist

- [x] Review composition before expanded art production.
- [x] Inspect terrain at close/minimum zoom and on phones.
- [x] Verify role routines, route clearance and selection independence.
- [x] Compare active, retained-inactive and campaign-complete presentation.
- [x] Exercise secondary screens, Reference, arrangements and backups.
- [x] Inspect final combined comparison inputs and record measurements.
- [ ] Complete the external browser/device/accessibility/player matrix before claiming full release readiness.
