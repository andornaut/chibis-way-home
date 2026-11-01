#!/usr/bin/env python3
"""Reusable peach home-city environment skins, independent of layouts and gameplay geometry.

Usage: homecity.py build | preview OUT.png. Run from the repository root. Pillow, plain PNG exports.
Canonical home-city zone-peach and its shade dominate; house colours add quiet roofs, windows and foliage.
No new palette, animals, doors, story text or mechanics. Near scenery has no collision or safe white lip.

Tiles-homecity: 12px tiles, eight columns, 28 cells, 96x48. Families outskirts-ground, brick-stack,
neighbourhood-ground and stoop-stack use top/top-left/top-right/top-joint/face/face-left/face-right.
Only terrain tops carry the navy edge and two white safe rows. Shared ledges, movers and red hazards
retain tiles-platforming. All material families use the existing generic terrain-renderer geometry.

Backdrops, bottom-left anchored at default world y600:
- homecity-sky: 48x600, repeat x, factor0,0.
- homecity-far: 720x600, repeat x, factor0.15,0.05; broad low-rise silhouettes without window grids.
- outskirts-mid: 720x600, repeat x, factor0.4,0.15; spaced residential roofs and quiet wall planes.
- neighbourhood-mid: 720x600, repeat x, factor0.4,0.15; familiar terraced homes and subdued garden crowns.
- outskirts-wall: 48x144, repeat x, factor1,1; low brick boundary wall aligned with the local floor.
- neighbourhood-wall: 48x180, repeat x, factor1,1; quiet residential facade, never a dense shopfront.
- homecity-awning: 96x36, no repeat, factor1,1; plain muted fabric without stripes or text.

Physical ledges and room doors are placed separately by gameplay. The comparison preview uses identical
illustrative geometry, not a validated stage or reachability claim. A theme changes appearance only.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
import nature  # noqa: E402
import zone_themes  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

T = 12
TILESET = "tiles-homecity"
PRIMARY = zone_themes.THEMES["home-city"]["primary"]
SHADE = PRIMARY + "-shade"
BOTTOM = 600
FAMILIES = ("outskirts-ground", "brick-stack", "neighbourhood-ground", "stoop-stack")
SUFFIXES = ("top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right")


def image(w, h, colour=None):
    return Image.new("RGBA", (w, h), pixel.rgb(colour) + (255,) if colour else (0, 0, 0, 0))


def rect(im, colour, box):
    im.paste(pixel.rgb(colour) + (255,), box)


def polygon(im, colour, points):
    ImageDraw.Draw(im).polygon(points, fill=pixel.rgb(colour) + (255,))


def material(family, suffix):
    im = image(T, T, SHADE)
    if family == "brick-stack":
        rect(im, PRIMARY, (0, 0, 12, 2))
        rect(im, "zone-red-shade", (0, 9, 12, 11))
        rect(im, "zone-red-shade", (5, 2, 7, 9))
    elif family == "stoop-stack":
        rect(im, PRIMARY, (0, 0, 12, 3))
        rect(im, "zone-red-shade", (0, 10, 12, 12))
    elif family == "neighbourhood-ground":
        rect(im, PRIMARY, (0, 0, 12, 2))
        rect(im, "zone-red-shade", (0, 10, 12, 12))
    if suffix.endswith("left"):
        rect(im, "dslate", (0, 0, 2, 12))
    if suffix.endswith("right"):
        rect(im, "dslate", (10, 0, 12, 12))
    if suffix.startswith("top"):
        rect(im, "navy", (0, 0, 12, 1))
        rect(im, "white", (0, 1, 12, 3))
        rect(im, PRIMARY, (0, 3, 12, 5))
        if suffix == "top-joint":
            rect(im, "dslate", (10, 3, 12, 7))
    return im


def tiles():
    return [(f"{family}-{suffix}", material(family, suffix))
            for family in FAMILIES for suffix in SUFFIXES]


def sky():
    return image(48, 600, PRIMARY)


def far():
    im = image(720, 600)
    for x, width, top in ((-20, 110, 420), (126, 102, 398), (262, 136, 438),
                          (434, 96, 384), (572, 166, 416)):
        rect(im, SHADE, (x, top + 18, x + width, 600))
        polygon(im, SHADE, ((x - 4, top + 20), (x + width // 2, top), (x + width + 4, top + 20)))
        rect(im, SHADE, (x + width - 24, top + 4, x + width - 16, top + 20))
    return im


def house(im, x, top, width, height, windows=True):
    """Warm complete plaster planes, a quiet rose roof and sparse attached window recesses."""
    rect(im, PRIMARY, (x, top + 18, x + width, top + height))
    rect(im, "zone-yellow", (x, top + 18, x + 8, top + height))
    polygon(im, "zone-red-shade", ((x - 4, top + 20), (x + width // 2, top),
                                  (x + width + 4, top + 20)))
    rect(im, "zone-red-shade", (x + width - 20, top + 2, x + width - 12, top + 16))
    if windows:
        for offset in (16, width - 28):
            rect(im, SHADE, (x + offset, top + 44, x + offset + 12, top + 64))


def outskirts_mid():
    im = image(720, 600)
    for x, top, width in ((-24, 426, 96), (126, 402, 108), (300, 430, 96),
                          (462, 402, 108), (648, 426, 96)):
        house(im, x, top, width, 600 - top)
    return im


def neighbourhood_mid():
    im = image(720, 600)
    for x, top, width in ((-12, 408, 84), (108, 390, 96), (240, 414, 84),
                          (360, 390, 96), (492, 408, 84), (624, 414, 108)):
        house(im, x, top, width, 600 - top)
    # Natural branching garden trees remain entirely decorative behind play.
    for x, top, width in ((82, 510, 46), (336, 498, 54), (592, 514, 48)):
        nature.broadleaf(im, x - width // 2, top, width, 64, 600, "zone-green-shade",
                         SHADE, 4, seed=x % 11)
    return im


def outskirts_wall():
    im = image(48, 144, PRIMARY)
    rect(im, PRIMARY, (0, 0, 48, 6))
    rect(im, "zone-red-shade", (0, 6, 48, 9))
    for y in range(24, 144, 24):
        rect(im, "zone-red-shade", (0, y, 48, y + 2))
        x = 12 if y // 24 % 2 else 36
        rect(im, "zone-red-shade", (x, y - 18, x + 2, y))
    rect(im, "zone-red-shade", (0, 138, 48, 144))
    return im


def neighbourhood_wall():
    im = image(48, 180, PRIMARY)
    rect(im, PRIMARY, (0, 0, 48, 9))
    rect(im, "zone-red-shade", (0, 9, 48, 12))
    rect(im, "zone-red-shade", (10, 30, 38, 78))
    rect(im, "dslate", (13, 33, 35, 74))
    rect(im, "zone-red-shade", (23, 33, 25, 74))
    rect(im, "zone-red-shade", (13, 52, 35, 54))
    rect(im, PRIMARY, (8, 78, 40, 84))
    rect(im, "zone-red-shade", (0, 168, 48, 180))
    return im


def awning():
    im = image(96, 36)
    polygon(im, "zone-red-shade", ((0, 16), (12, 0), (83, 0), (95, 16), (95, 25), (0, 25)))
    polygon(im, PRIMARY, ((2, 16), (14, 2), (81, 2), (93, 16)))
    rect(im, SHADE, (2, 17, 94, 24))
    rect(im, "zone-red-shade", (12, 25, 15, 36))
    rect(im, "zone-red-shade", (81, 25, 84, 36))
    return im


BACKDROPS = {
    "homecity-sky": (sky, "x", (0, 0)),
    "homecity-far": (far, "x", (0.15, 0.05)),
    "outskirts-mid": (outskirts_mid, "x", (0.4, 0.15)),
    "neighbourhood-mid": (neighbourhood_mid, "x", (0.4, 0.15)),
    "outskirts-wall": (outskirts_wall, "x", (1, 1)),
    "neighbourhood-wall": (neighbourhood_wall, "x", (1, 1)),
    "homecity-awning": (awning, "none", (1, 1)),
}


def registry():
    return [{"key": key, "png": f"backdrops/{key}.png", "width": fn().width, "height": fn().height,
             "anchor": "bottom-left", "y": BOTTOM, "repeat": repeat}
            for key, (fn, repeat, _) in BACKDROPS.items()]


def build():
    os.makedirs("public/art/backdrops", exist_ok=True)
    ts = pixel.write_tileset(TILESET, tiles())
    for key, (fn, _, _) in BACKDROPS.items():
        fn().save(f"public/art/backdrops/{key}.png")
    pixel.update_manifest("tilesets", [ts])
    pixel.update_manifest("backdrops", registry())


def context(kind):
    im = image(720, 720, PRIMARY)
    for key in ("homecity-sky", "homecity-far", "outskirts-mid" if kind == "outskirts" else "neighbourhood-mid"):
        p = BACKDROPS[key][0]()
        for x in range(0, 720, p.width):
            im.alpha_composite(p, (x, 600 - p.height))
    if kind == "outskirts":
        for x in range(0, 192, 48):
            im.alpha_composite(outskirts_wall(), (x, 456))
        ground, raised = "outskirts-ground", "brick-stack"
    else:
        for x in range(0, 192, 48):
            im.alpha_composite(neighbourhood_wall(), (x, 420))
        im.alpha_composite(awning(), (240, 492))
        ground, raised = "neighbourhood-ground", "stoop-stack"
    ts = dict(tiles())
    for col, row, width, height, family in ((0, 50, 60, 10, ground), (20, 46, 6, 4, raised),
                                            (32, 42, 7, 8, raised), (45, 38, 6, 12, raised)):
        for y in range(height):
            for x in range(width):
                suffix = ("top-left" if x == 0 else "top-right" if x == width - 1 else
                          "top-joint" if x % 2 else "top") if y == 0 else \
                    ("face-left" if x == 0 else "face-right" if x == width - 1 else "face")
                im.alpha_composite(ts[f"{family}-{suffix}"], ((col + x) * T, (row + y) * T))
    bird = Image.open("public/art/sprites/bird.png").convert("RGBA").crop((0, 0, 48, 42))
    im.alpha_composite(bird, (72, 558))
    return im.crop((0, 360, 720, 720)).convert("RGB")


def preview(out):
    board = image(1456, 392, "ink")
    for i, kind in enumerate(("outskirts", "neighbourhood")):
        ImageDraw.Draw(board).text((8 + i * 728, 6), kind, fill=pixel.rgb("cream"))
        board.alpha_composite(context(kind).convert("RGBA"), (8 + i * 728, 24))
    board.convert("RGB").save(out)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit(__doc__)
