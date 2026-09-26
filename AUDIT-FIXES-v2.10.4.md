# v2.10.4 — interaction and recovery audit

This patch fixes reproducible presentation and storage bugs. The numeric engine, economic commands and save envelope are unchanged; their byte-parity tests still pass.

## Fixed

1. Menu arrow keys now stay on visible menu tabs. Destination shortcuts focus a visible heading, and the tablist announces its actual horizontal layout.
2. The settlement tray, building ledger and B shortcut now share one purchase quantity.
3. Closing decoration or building details restores visible keyboard focus. Opening a phone detail puts focus inside it.
4. Edited purchasing-order inputs now display the correct target after reordering.
5. A queued approach can be reversed by keeping the current approach for the next Translation, using the existing economic command.
6. Codex searches accept ordinary hyphens, typographic dashes, extra spacing and equivalent apostrophes. Scripture text is unchanged.
7. Full-backup imports verify each write and journal removal. Failed rollback retains recovery data; another import or campaign reset cannot overwrite an unresolved journal. Recovery tolerates malformed device-preference JSON values.
8. Visual preference writes are verified; a failed setting change reverts its control and reports the failure.
9. Optional artwork downloads remain usable when cache access, insertion or eviction fails.
10. Short-phone world controls sit above the expanded purchase sheet. Landscape zoom controls no longer sit beneath the navigation dock.

## Verification

- All 37 release test files passed locally. After the final recovery guards and responsive adjustments, the affected audit, saving, security, presentation, placement and delivery tests passed again.
- Ten new regression groups cover failed import writes, pending recovery, malformed preferences, verified commits, silently lost preference changes, reference normalization, edited inputs and optional-art cache failures.
- Browser checks used the Codex Chromium browser at 1280×720, 390×844, 320×568 and 640×400. Tested Menu/Projects/Stats navigation, Codex search, quantity shortcut, hiring, approach scheduling/reversal, order editing/reordering, decoration placement/movement, normal save import, and first Translation with its onboarding dialog.
- No console errors or warnings were observed in the local browser checks. Narrow and landscape checks had no document horizontal overflow.
- Initial playable build: 3,607,590 bytes. Optimized artwork: 33,287,230 bytes. Build: `6c10de4a15042355`.
- Automated tests cover schema migration, malformed saves, economic parity, queues at one hour/eight hours/one day/seven days, root/subdirectory hosting and service-worker failures.

## Limits

This is a bounded regression audit, not proof that no bugs remain. Firefox, Safari, physical Android/iOS, a full screen-reader run, browser 200% zoom, a complete campaign playthrough and human enjoyment testing were not performed in this patch. Advanced Network/Field/Legacy logic was covered by regression tests rather than new full browser playthroughs. Visual tests used generated local QA progress, never the player's live save.
