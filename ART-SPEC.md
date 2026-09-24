# Editable artwork and animation — v2.10

The art archive contains generated raster masters and editable crop/placement metadata. It does not contain vector or PSD reconstructions. Every newly generated master includes a prompt sidecar. The production game needs no generation service or network API.

| Source | Native detail / use |
|---|---|
| Four terrain detail tiles | Each 1536×1024; combined working master 3072×2048, with overlapping seam guides |
| `terrain-native-3072.png`, `terrain-assembly.json` | Assembled landscape and provenance; not an enlarged old painting |
| `layers/` | Aligned separate sky, coast, water, terraces and foreground raster layers |
| Six `*-stages.png` atlases | Each 1536×1024; four measured crops per family, 24 individual transparent building files |
| `buildings/` | Crops and separate foreground/doorway masks |
| `equipment.png`, `commissions.png` | Eight Method pieces and three completed commission objects |
| `milestones.png`, `campaign-keepsakes.png` | 24 building-specific later milestone pieces and six permanent achievement objects |
| `worker-variants.png`, `work-props.png` | Three sets of consistent torso/head, arms, legs and bundle parts; reusable books/pages/stack/equipment props |
| `environment-activity.png` | Boat, birds, branch, cloth, window and light pieces |
| Nine `journey-*.png` masters | Each 1536×1024; six Field archetypes, Translation, Network and Legacy |
| `navigation.png` | Three illustrated destination medallions |

The authored six site coordinates and expanded landscape bounds are unchanged. Crop metadata preserves each building's aspect ratio. Runtime portraits use the same current historical stage; surveyed portraits no longer imply established architecture.

Contact shadows are rendered independently. Workstations and routes are outside solid footprints and are depth sorted. Doorway and foreground masks are supplied as editable crop masks; the current outdoor routines do not use interior-mask choreography. Do not assume these generic masks already describe every architectural opening precisely. Architecture contains no baked-in workers or operating light effects.

`settlement-clips.js` defines task poses; `settlement-animation.js` defines paths, stationary work sockets, phases and worker allocation; `worker-painter.js` applies those transforms to the same source parts. Selection does not reset the monotonic animation clock. Hidden/covered surfaces stop scheduling decorative frames. Reduced motion uses deterministic fixed poses.

`tools/prepare-v210-art.py --source ../art-source-v210` packs crops, creates WebP resolution variants and writes `crafted-assets.js`. Pillow/NumPy are needed only for art preparation. `tools/assemble-v210-terrain.py` records tile/layer assembly. The ordinary build is Python standard library only.

Low-resolution fallback buildings, terrain and interface materials from earlier releases remain in source. Fonts are self-hosted Alegreya and Source Sans 3 with their included OFL licenses. Scripture provenance remains in `docs/scripture-provenance.json`.
