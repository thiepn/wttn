# Settlement artwork

Original raster artwork generated for this redesign from the selected first sunlit-settlement concept. Terrain, building sheets, workers, equipment/decorations, navigation medallions and Journey landscape are independent assets. No external asset CDN or third-party font is required.

The art direction uses warm limestone, terracotta, indigo cloth, olive foliage, Mediterranean sea light and a consistent elevated fixed camera. Asset dimensions and sprite rows/columns are defined in `settlement-assets.js`; authored building positions live in the pure settlement model. Buildings have foundation, established and developed variants. A cell-bottom crop avoids adjacent-sheet bleed.

The seven editable WebP files live in `assets/settlement`. Full-resolution artwork totals 3,270,064 bytes. Embedded fallback variants are at most 768 px on the longest side, WebP quality 72. Run `tools/build-settlement-art.py` with Pillow to regenerate them. Web images progressively replace embedded variants; portable uses embedded variants only.

Illustrated workers represent activity, not every owned producer. Walking/writing frame changes and authored paths are decorative. Some role-specific teaching/equipment poses are static illustrations. The game does not derive earnings from animation. A bounded event layer provides selection, construction, delivery, commission and departure feedback.

Cosmetics add visible banner/planting/courtyard objects; they never change income. Authored buildings include their own fixed painted details. No free-placement grid or upkeep was added.
