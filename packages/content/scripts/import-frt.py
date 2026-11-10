"""
One-off importer: converts the flamme-rouge-tracks.com tile list (saved locally, git-ignored, at
docs/tiles/frt-tracktiles.json) into our TileCatalog JSON at packages/content/src/data/tiles.json.

Code meanings, checked against the site's tile diagrams:
  layout digit: 1 flat, 2 ascent, 3 descent, 4 supply zone, 5 cobblestone,
                6 start/finish zone (grid on start tiles, past-the-line on finish tiles,
                breakaway squares on the breakaway tile)
  width digit:  lane count
Every square is imported with verified=false until checked against the rulebook diagrams.
Usage: python3 -I packages/content/scripts/import-frt.py docs/tiles/frt-tracktiles.json out.json
"""
import json
import sys

TERRAIN = {"1": "flat", "2": "ascent", "3": "descent", "4": "supply", "5": "cobblestone", "6": "flat"}

src, out = sys.argv[1], sys.argv[2]
raw = json.load(open(src))
by_symbol = {}
for t in raw:
    by_symbol.setdefault(t["symbol"], []).append(t["name"])

tiles = []
for t in raw:
    layout, width = str(t["layout"]), str(t["width"])
    assert len(layout) == len(width) == t["length"], t["name"]
    squares = []
    for i, (code, lanes) in enumerate(zip(layout, width)):
        flags = []
        if code == "6":
            if t["start"]:
                flags.append("startGrid")
            elif t["breakaway"]:
                flags.append("breakaway")
        squares.append({"lanes": int(lanes), "terrain": TERRAIN[code], "flags": flags, "verified": False})
    notes = []
    if t["start"]:
        first_open = next(i for i, c in enumerate(layout) if c != "6")
        squares[first_open]["flags"].append("startLine")
    if t["finish"]:
        last_road = max(i for i, c in enumerate(layout) if c != "6")
        squares[last_road + 1]["flags"].append("finishLine")
        notes.append("Squares past the finish line imported as flat; verify terrain and line position.")
    if t["breakaway"]:
        notes.append("Breakaway square position and effect to verify against the Peloton rulebook.")
    if t["type"] == "turn":
        shape = {
            "kind": "curve",
            "severity": "tight" if t["turn_degree"] == 90 else "gentle",
            "direction": t["direction"],
        }
    elif t["start"]:
        shape = {"kind": "start"}
    elif t["finish"]:
        shape = {"kind": "finish"}
    else:
        shape = {"kind": "straight"}
    entry = {
        "id": t["name"],
        "flipSide": next(n for n in by_symbol[t["symbol"]] if n != t["name"]),
        "source": "base" if t["version"] == "base_game" else "peloton",
        "shape": shape,
        "segments": [{"type": "linear", "squares": squares}],
    }
    if t["type"] == "short_straight":
        notes.append("Half-length straight.")
    if notes:
        entry["notes"] = " ".join(notes)
    tiles.append(entry)

json.dump({"version": 1, "tiles": tiles}, open(out, "w"), indent=1)
print(f"wrote {len(tiles)} tile sides to {out}")
