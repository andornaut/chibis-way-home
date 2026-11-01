#!/usr/bin/env python3
"""Reusable platforming pieces, 12px tiles in eight columns, with the street's blue-grey materials.

Usage: obstacles.py build | preview OUT.png
Run from the repository root. Build writes tiles-platforming.png/.json and merges its manifest entry.

Solid terrain is assembled from top, bottom, left, right, corner and fill tiles. The top has a white lip;
wall and ceiling edges have no white lip. One-way ledges are thin slabs, transparent underneath.

Hazards are separate transparent overlay tiles: a solid 4px bright-red panel on the supporting surface
or edge, never spikes. Every theme uses the same red. Place hazard-top in the cell ABOVE a solid: its band
occupies rows 8..11. Place hazard-bottom BELOW a solid (rows 0..3), hazard-left LEFT of a solid (columns
8..11), and hazard-right RIGHT of a solid (columns 0..3). Their hitboxes cover exactly the four visible
rows or columns, so a contact kills from any direction. Overlays have no terrain collision themselves.
The supporting solid retains its full-cell collision. No hazard is drawn across a safe white lip.

The preview is a conceptual 720x720 assembly with two 720x360 phone views, a low-ceiling jump, a high
ledge and floor, wall and ceiling contact strips. It is an art composition, not a validated level.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
from PIL import Image  # noqa: E402

KEY = "tiles-platforming"
T = 12
HITBOXES = {
    "hazard-bottom": {"x": 0, "y": 0, "width": 12, "height": 4},
    "hazard-left": {"x": 8, "y": 0, "width": 4, "height": 12},
    "hazard-right": {"x": 0, "y": 0, "width": 4, "height": 12},
    "hazard-top": {"x": 0, "y": 8, "width": 12, "height": 4},
}


def rect(im, box, colour):
    im.paste(pixel.rgb(colour) + (255,), box)


def solid(top=False, bottom=False, left=False, right=False):
    im = Image.new("RGBA", (T, T), pixel.rgb("slate") + (255,))
    if left:
        rect(im, (0, 0, 2, T), "dslate")
    if right:
        rect(im, (10, 0, 12, T), "dslate")
    if bottom:
        rect(im, (0, 9, T, 11), "dslate")
        rect(im, (0, 11, T, 12), "navy")
    if top:
        rect(im, (0, 0, T, 1), "navy")
        rect(im, (0, 1, T, 3), "white")
        rect(im, (0, 3, T, 5), "lgrey")
    return im


def ledge(side):
    im = Image.new("RGBA", (T, T))
    for y0, y1, colour in ((0, 1, "navy"), (1, 3, "white"), (3, 5, "lgrey"), (5, 6, "dslate")):
        rect(im, (0, y0, T, y1), colour)
    if side == "left":
        rect(im, (0, 3, 1, 6), "navy")
    if side == "right":
        rect(im, (11, 3, 12, 6), "navy")
    return im


def hazard(side):
    im = Image.new("RGBA", (T, T))
    x, y, w, h = (HITBOXES[f"hazard-{side}"][k] for k in ("x", "y", "width", "height"))
    rect(im, (x, y, x + w, y + h), "red")
    return im


def tiles():
    items = []
    for name, flags in (("platform-top", (1, 0, 0, 0)), ("platform-top-left", (1, 0, 1, 0)),
                        ("platform-top-right", (1, 0, 0, 1)), ("platform-top-joint", (1, 0, 0, 0)), ("platform-face", (0, 0, 0, 0)),
                        ("platform-face-left", (0, 0, 1, 0)), ("platform-face-right", (0, 0, 0, 1)),
                        ("platform-bottom", (0, 1, 0, 0)), ("platform-bottom-left", (0, 1, 1, 0)),
                        ("platform-bottom-right", (0, 1, 0, 1))):
        tile = solid(*flags)
        if name == "platform-top-joint":
            rect(tile, (10, 5, 12, 7), "dslate")
        items.append((name, tile))
    items.extend((f"one-way-ledge-{side}", ledge(side)) for side in ("left", "middle", "right"))
    items.extend((f"hazard-{side}", hazard(side)) for side in ("top", "bottom", "left", "right"))
    return items


def build():
    entry = pixel.write_tileset(KEY, tiles(), hitboxes=HITBOXES)
    path = "public/art/" + entry["json"]
    with open(path) as f:
        data = json.load(f)
    data["tiles"]["one-way-ledge"] = data["tiles"]["one-way-ledge-middle"]
    with open(path, "w") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")
    pixel.update_manifest("tilesets", [entry])


def preview(out):
    im = Image.new("RGBA", (720, 720), pixel.rgb("lgrey") + (255,))
    ts = dict(tiles())

    def put(name, c, r):
        im.alpha_composite(ts[name], (c * T, r * T))

    def block(c, r, w, h):
        for yy in range(h):
            for xx in range(w):
                name = "platform-top" if yy == 0 else "platform-bottom" if yy == h - 1 else "platform-face"
                side = "-left" if xx == 0 else "-right" if xx == w - 1 else ""
                put((name + side) if side else name, c + xx, r + yy)

    # Open skyline silhouettes stay lower in contrast than the play plane.
    for c, r, w in ((0, 12, 8), (11, 5, 6), (22, 9, 10), (37, 3, 8), (50, 11, 10)):
        rect(im, (c * T, r * T, (c + w) * T, 600), "grey")
    block(0, 50, 60, 10)
    block(5, 44, 8, 2)
    block(18, 39, 7, 3)
    block(31, 35, 9, 3)
    block(43, 29, 10, 4)
    block(7, 17, 12, 2)
    # Low ceiling above the short route; strips project into free cells.
    block(5, 44, 8, 2)
    block(5, 38, 8, 2)
    for c in range(5, 13):
        put("hazard-bottom", c, 40)
    for c in range(26, 30):
        put("hazard-top", c, 49)
        put("platform-face", c, 50)
    for r in range(36, 38):
        put("hazard-left", 30, r)
        put("hazard-right", 40, r)
    for c in range(19, 23):
        side = "left" if c == 19 else "right" if c == 22 else "middle"
        put(f"one-way-ledge-{side}", c, 22)
    bird = Image.open("public/art/sprites/bird.png").convert("RGBA").crop((0, 0, 48, 42))
    im.alpha_composite(bird, (24, 600 - 42))
    im.convert("RGB").save(out)
    stem = os.path.splitext(out)[0]
    im.crop((0, 360, 720, 720)).convert("RGB").save(stem + "-lower.png")
    im.crop((0, 0, 720, 360)).convert("RGB").save(stem + "-upper.png")
    im.convert("L").save(stem + "-grey.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit(__doc__)
