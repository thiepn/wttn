# Crafted settlement artwork specification

## Common direction

Fixed-angle Mediterranean terraces, warm upper-left light, restrained ochre stone and terracotta. Architecture is the focus; planting frames paths without covering them. Canvas ground coordinates remain 1536×1024. The landscape bounds remain x −628.012, y −436.01, width 2848.476, height 1874.038.

The desktop, phone and Journey compositions are presentation references. Text and controls are HTML. Generated labels are not authoritative content. The renderer uses the game's six existing authored sites.

## Source and runtime separation

- Native generated PNG masters and prompts are retained in the editable artwork archive.
- `tools/prepare-v210-art.py` encodes responsive WebP files without inventing higher resolution.
- Four native detail tiles form the 3072×2048 terrain working master. Tile seams must pass the stage-2 visual gate. Transparent terrain layers retain the same coordinate transform.
- Building atlases contain four stages. Measured crop metadata, rather than assumed equal-cell boundaries, prevents roof clipping. The renderer preserves each crop's aspect ratio.
- Architecture contains no workers, active lamps or running equipment. Contact shadows, workstations, equipment sockets, and doorway metadata are independent.
- Portraits reuse the same stage crop, including surveyed sites. They cannot accidentally display established architecture at zero historical workforce.
- Methods, commissions, milestones and navigation use the same paint treatment. Their crops and anchors remain editable metadata.
- Journey artwork is requested for the selected briefing only. No full-collection preload.

## Runtime budgets

The shared Settlement/Journey pool permits three simultaneous image downloads and keeps 96 MiB decoded on desktop, 48 MiB on narrow screens. Failed URLs are attempted once per page lifetime. A low-resolution scene is included with essential code; detailed art is optional. Quality affects image resolution and representative activity, never economic commands or disclosure.

## Animation ownership

Workers have a shared monotonic presentation clock independent of selection, economic ticks and save data. The rig source is reusable; clips transform parts of the same artwork. Decorative animation does not change production. All outdoor routes and placement sites are checked against authoritative building footprints.
