Tile reference material. Git-ignored apart from this README.

- `frt-tracktiles.json`: tile list from flamme-rouge-tracks.com (a fan-made track generator), saved
  2026-11-10. 60 tile sides: 21 base tiles and 9 Peloton tiles, both sides. No Grand Tour tiles.
- `frt-images/`: that site's schematic diagram of each side (reference only, never shipped).
- Owner photos of the physical tiles, when available.

`packages/content/scripts/import-frt.py` converts the JSON into `packages/content/src/data/tiles.json`.
