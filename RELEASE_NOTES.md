# v2.10.0 — A Living, Crafted Settlement

## Post-release gameplay safety hotfix

- Automation unlocks no longer execute irreversible actions on purchase. Basic, Project and Translation automation unlock paused; Full Production Automation follows the existing Base Automation switch.
- Planned purchases reserve priority over automatic spending and Auto-Translation. Full Automation also stops spending when the Translation boundary is less than about a minute away at current production.
- Full Production Automation no longer buys the utility-only Reference System, and recommendation surfaces no longer present it as an economic upgrade.
- Project Queue completes one eligible Project per cycle until Parallel Projects is owned; Parallel Projects now has a real mechanical effect.
- Preparation Lv4 and the Open Projects Legacy milestone now reveal Projects from the start of a run instead of being dead text.
- Translation and Network readiness compression can reduce an immature repeat reset below one reward instead of being cancelled by a forced minimum.
- Higher resets clear stale Translation-gain comparison targets, Field rewards cannot be inflated by farming excess NC after objectives are complete, and Legacy milestones earned by a Legacy reset no longer rewrite that same reset.
- Specializations now consistently unlock at 100 lifetime TI. Translation/Network investment guidance shares one opportunity-cost model and protects nearby permanent unlocks from contradictory spend recommendations.


## What changes

- A native 3072×2048 terrain assembled from detailed source tiles, with separate sky, coast, water, terrace and foreground layers. The expanded scenery covers the authored camera limits.
- Six architectural families with surveyed, established, expanded and developed artwork. Twenty-four later milestone objects and six campaign keepsakes distinguish mature settlements. Retained architecture and current activity are separate.
- Three reusable worker appearances and writing, checking, stacking, carrying, teaching/listening and equipment clips. Outdoor paths, directional facing and shadows replace the common carrying loop. Selecting a building does not restart activity. Caps remain 24/12/6 for desktop/phone/Low.
- Eight Method illustrations, three commission objects, stage-correct building portraits, navigation medallions and nine responsive Journey scenes. Local birds, water, boats, cloth and light animate calmly. Reduced motion uses fixed work poses.
- Compact floating parchment controls, consistent button/disclosure states, a safe selected-building frame and a six-site phone Overview. Journey uses one destination selector with its adjacent briefing; phone Journey uses a single scroll surface.
- Illustrated commission briefs; canonical and thematic Codex browsing; editable planned targets and clearer blocked reasons; automatic return recap with a next-action button; consistent Gain / Rebuild / Keep / Start with previews before and after eligibility.
- Reference System keeps its ID, 1-billion-Page price and reset rules. Current ownership opens detailed producer relationships, active factors and authoritative before/after commission comparisons in Commissions and the Library. It grants no direct production multiplier. Essential information remains free.
- Reference Project explains its synergy even when rounded to ×1.00. Producer milestones use concrete wording, including the Library's lack of a higher-building synergy. Post-reset objectives prioritize useful actions.
- Twelve decorations now have three approved sites each, previews, Place/Move/Remove, an accessible list, world markers and three curated arrangements. All are free. Full backups carry placements; older progress-only saves remain compatible.
- Construction, hiring, installation, commission, departure and finale feedback is bounded. Commands are immediate; animations never change earnings. The finale returns to the completed settlement without a second overlapping dialog.

## What is preserved

Core prices, producer production values, campaign content, the numeric engine and the save envelope remain intact. `game-core.js` now intentionally differs from v2.9 because of the progression-safety fixes above; `bignum.js` and `save-format.js` remain byte-identical to the frozen baseline. Schema 8, storage key, migration rules and recovery backups remain intact. Audio is still optional and off by default; Scripture reading remains economically neutral.

## Delivery

Web build and source, editable raster/animation sources, matched v2.9/v2.10 screenshots, a captured gameplay walkthrough, GitHub Pages workflow/manual instructions and raw verification results. No site was published. The walkthrough uses a funded opening fixture, then cuts to a developed presentation fixture; it is not a campaign playthrough or frame-rate benchmark.

## Remaining release work

Five new-player opening/return sessions, actual Android/iOS performance and multi-touch, Firefox/Safari, real screen-reader use and verified 200% browser zoom. The full update path has executable service-worker tests; a real interrupted deployment still needs platform testing. The historical offline timing failure is documented separately in VERIFICATION.md. Automated checks do not establish fun, balance quality across a full playthrough, or a “2×” visual improvement.
