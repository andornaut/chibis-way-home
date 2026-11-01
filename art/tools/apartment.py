#!/usr/bin/env python3
"""Apartment environment core, reusable independently of layouts and collision.

Usage: apartment.py build | preview OUT.png. Pillow plain PNGs, no animation. Run from repository root.
Canonical zone-red dusty rose dominates walls and exterior haze. Existing wood, sage and blue accents only.
Tiles-apartment: six families apartment-wood/tile/plaster/stone/brick/metal, each seven standard suffixes:
top/top-left/top-right/top-joint/face/face-left/face-right. 42 cells,12px,8columns,96x72. Only safe top
cells carry the dark edge and two-pixel white lip. Shared ledges, hazards and movers retain tiles-platforming.

Backdrops: apartment-sky48x720, apartment-far720x720, apartment-exterior-mid720x720, all repeatx;
apartment-wall-lobby/restaurant/pool/spa/residential48x144repeatx; apartment-facade48x180repeatx.
All bottom-left, defaulty720. Near walls/facade align to local floor and move with terrain (factor1,1).
Suggested outdoor factors: sky0,0 far.15,.05 mid.4,.15. Keep gaps open to the distant layers.
Wall names indicate materials, not room behaviour. Pool wall tiles depict no water or hidden danger.
No actors, stairs, props, story, route layout or physics. Decor carries no white safe lip or hazard red.
Preview assembles short illustrative sections on common geometry, not a validated playable stage.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
import zone_themes  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

T = 12
COLUMNS = 8
TILESET = "tiles-apartment"
BOTTOM = 720
PRIMARY = zone_themes.THEMES["apartment"]["primary"]
SHADE = PRIMARY + "-shade"
FAMILIES = tuple("apartment-" + name for name in ("wood", "tile", "plaster", "stone", "brick", "metal"))
SUFFIXES = ("top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right")


def image(width, height, colour=None):
    return Image.new("RGBA", (width, height), pixel.rgb(colour) + (255,) if colour else (0, 0, 0, 0))


def rect(im, colour, box):
    im.paste(pixel.rgb(colour) + (255,), box)


def material(family, suffix):
    name = family.removeprefix("apartment-")
    fill = {"wood": "zone-peach-shade", "tile": "lgrey", "plaster": SHADE,
            "stone": "grey", "brick": PRIMARY, "metal": "slate"}[name]
    im = image(T, T, fill)
    if name in ("wood", "brick"):
        rect(im, "brown" if name == "wood" else SHADE, (0, 8, 12, 10))
    elif name == "tile":
        rect(im, "grey", (0, 10, 12, 12))
        rect(im, "grey", (10, 0, 12, 10))
    elif name == "stone":
        rect(im, "slate", (0, 10, 12, 12))
    elif name == "metal":
        rect(im, "dslate", (0, 8, 12, 10))
    if suffix.endswith("left"):
        rect(im, "navy", (0, 0, 2, 12))
    if suffix.endswith("right"):
        rect(im, "navy", (10, 0, 12, 12))
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
    return image(48, 720, PRIMARY)


def far():
    im = image(720, 720)
    for x, width, top in ((-12, 132, 446), (158, 100, 402), (298, 152, 470),
                          (492, 112, 430), (642, 96, 452)):
        rect(im, "zone-peach-shade", (x, top, x + width, 720))
        rect(im, "zone-peach-shade", (x + 14, top - 14, x + width - 14, top))
        rect(im, "zone-peach-shade", (x + width - 28, top - 28, x + width - 18, top))
    return im


def exterior_mid():
    im = image(720, 720)
    for x, width, top in ((24, 162, 552), (248, 126, 514), (442, 146, 568), (636, 72, 532)):
        rect(im, SHADE, (x, top, x + width, 720))
        rect(im, "zone-peach-shade", (x, top, x + width, top + 8))
        rect(im, "zone-peach", (x + 8, top + 8, x + 14, 720))
        rect(im, "zone-red", (x + 22, top + 38, x + width - 22, top + 50))
    return im


def wall(style):
    im = image(48, 144, PRIMARY)
    rect(im, SHADE, (0, 0, 48, 6))
    rect(im, SHADE, (0, 132, 48, 144))
    if style == "lobby":
        rect(im, "zone-peach-shade", (0, 90, 48, 132))
        rect(im, "brown", (0, 90, 48, 94))
        rect(im, "brown", (22, 94, 24, 132))
    elif style == "restaurant":
        rect(im, SHADE, (0, 84, 48, 132))
        rect(im, "zone-peach", (0, 84, 48, 90))
        rect(im, PRIMARY, (4, 100, 44, 124))
    elif style == "pool":
        rect(im, "zone-blue", (0, 96, 48, 132))
        for x in (0, 24):
            rect(im, "zone-blue-shade", (x, 96, x + 2, 132))
        rect(im, "zone-blue-shade", (0, 112, 48, 114))
    elif style == "spa":
        rect(im, "zone-green", (0, 102, 48, 132))
        rect(im, "zone-green-shade", (0, 100, 48, 104))
        rect(im, SHADE, (22, 8, 24, 98))
    else:
        rect(im, SHADE, (0, 98, 48, 132))
        rect(im, PRIMARY, (4, 106, 44, 124))
    return im


def facade():
    im = image(48, 180, PRIMARY)
    rect(im, SHADE, (0, 0, 48, 8))
    rect(im, SHADE, (0, 170, 48, 180))
    for y in (28, 100):
        rect(im, "dslate", (8, y, 40, y + 48))
        rect(im, "zone-blue-shade", (11, y + 3, 37, y + 45))
        rect(im, "slate", (23, y + 3, 25, y + 45))
        rect(im, "slate", (11, y + 24, 37, y + 26))
    return im


BACKDROPS = {
    "apartment-exterior-mid": (exterior_mid, "x"),
    "apartment-facade": (facade, "x"),
    "apartment-far": (far, "x"),
    "apartment-sky": (sky, "x"),
    **{"apartment-wall-" + style: (lambda style=style: wall(style), "x")
       for style in ("lobby", "restaurant", "pool", "spa", "residential")},
}


def build():
    os.makedirs("public/art/backdrops", exist_ok=True)
    pixel.update_manifest("tilesets", [pixel.write_tileset(TILESET, tiles())])
    entries = []
    for key, (draw, repeat) in BACKDROPS.items():
        im = draw()
        im.save(f"public/art/backdrops/{key}.png")
        entries.append({"key": key, "png": f"backdrops/{key}.png", "width": im.width, "height": im.height,
                        "anchor": "bottom-left", "y": BOTTOM, "repeat": repeat})
    pixel.update_manifest("backdrops", entries)
    print("built", TILESET, "and", len(entries), "backdrops")


def context():
    """Material contact sheet on common illustrative geometry; no route or stair behaviour claim."""
    import json

    im = image(720, 360, PRIMARY)
    far_im = far().crop((0, 360, 720, 720))
    im.alpha_composite(far_im)
    im.alpha_composite(exterior_mid().crop((0, 360, 720, 720)))
    labels = ("Lobby", "Restaurant", "Pool", "Spa", "Residential", "Exterior")
    for i, style in enumerate(("lobby", "restaurant", "pool", "spa", "residential")):
        for x in range(i * 120, i * 120 + 120, 48):
            width = min(48, (i + 1) * 120 - x)
            for y in (-48, 96):
                im.alpha_composite(wall(style).crop((0, 0, width, 144)), (x, y))
    im.alpha_composite(facade(), (672, 60))
    ts = dict(tiles())
    for i, family in enumerate(FAMILIES):
        for y in range(240, 360, 12):
            for x in range(i * 120, (i + 1) * 120, 12):
                suffix = "top" if y == 240 else "face"
                im.alpha_composite(ts[family + "-" + suffix], (x, y))
        for x in range(i * 120 + 48, i * 120 + 96, 12):
            im.alpha_composite(ts[family + "-top"], (x, 216))
            im.alpha_composite(ts[family + "-face"], (x, 228))
        ImageDraw.Draw(im).text((i * 120 + 4, 76), labels[i], fill=pixel.rgb("ink"))
    data = json.load(open("public/art/sprites/bird.json"))
    f = next(iter(data["frames"].values()))["frame"]
    bird = Image.open("public/art/sprites/bird.png").convert("RGBA")
    bird = bird.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    im.alpha_composite(bird, (12, 198))
    return im.convert("RGB")


def preview(out):
    context().save(out)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit("Usage: apartment.py build | preview OUT.png")
