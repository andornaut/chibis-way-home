#!/usr/bin/env python3
"""Reusable woodland appearance skins. Usage: woodland.py build | preview OUT.png, from repository root.

Pillow plain PNG, no animations. Canonical woodland zone-green and shade, existing house palette only.
Tiles-woodland: 12px, eight columns, 28 cells in96x48. Families forest-ground/root-stack/ravine-ground/
stone-stack each use top/top-left/top-right/top-joint/face/face-left/face-right. Generic geometry unchanged.
Only top tiles have dark edge and white lip. Shared ledges, hazards and movers retain tiles-platforming.

Backdrops bottom-left y600: woodland-sky48x600 repeatx factor0,0; woodland-far720x600 repeatx .15,.05;
forest-mid/ravine-mid720x600 repeatx .4,.15; forest-tree96x216 none, forest-shrub48x48 repeatx,
ravine-rock72x72 none at1,1. Near pieces align local floor. Decor has no collision, white safe lips or red
hazard marking. Natural decor uses tonal fills without dark contour bands. Keep silhouettes clear of required
routes. Distant ravine water is decorative only.
No actors or natural hidden lethality. Context uses identical illustrative geometry, not validated stages.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
import zone_themes  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

T = 12
COLUMNS = 8
TILESET = "tiles-woodland"
BOTTOM = 600
PRIMARY = zone_themes.THEMES["woodland"]["primary"]
SHADE = PRIMARY + "-shade"
FAMILIES = ("forest-ground", "root-stack", "ravine-ground", "stone-stack")
SUFFIXES = ("top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right")


def image(width, height, colour=None):
    return Image.new("RGBA", (width, height), pixel.rgb(colour) + (255,) if colour else (0, 0, 0, 0))


def rect(im, colour, box):
    im.paste(pixel.rgb(colour) + (255,), box)


def polygon(im, colour, points):
    ImageDraw.Draw(im).polygon(points, fill=pixel.rgb(colour) + (255,))


def material(family, suffix):
    fill = {"forest-ground": "zone-green-shade", "root-stack": "zone-yellow-shade",
            "ravine-ground": "slate", "stone-stack": "grey"}[family]
    im = image(T, T, fill)
    if family == "root-stack":
        rect(im, "brown", (0, 8, 12, 10))
        rect(im, "brown", (4, 0, 6, 8))
    elif family == "stone-stack":
        rect(im, "slate", (0, 8, 12, 10))
        rect(im, "slate", (4, 0, 6, 8))
    if suffix.endswith("left"):
        rect(im, "dslate", (0, 0, 2, T))
    if suffix.endswith("right"):
        rect(im, "dslate", (10, 0, 12, T))
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
    for x, top, width in ((0, 350, 80), (88, 298, 110), (220, 332, 88),
                          (346, 314, 98), (478, 340, 100), (610, 300, 110)):
        polygon(im, SHADE, ((x, top + 96), (x + width // 2, top), (x + width, top + 96)))
        rect(im, SHADE, (x + width // 2 - 6, top + 80, x + width // 2 + 6, 600))
    return im


def forest_mid():
    im = image(720, 600)
    for x, top, width in ((24, 410, 96), (178, 390, 110), (370, 420, 100), (556, 382, 120)):
        rect(im, "zone-green-shade", (x + width // 2 - 8, top, x + width // 2 + 8, 600))
        polygon(im, "zone-green-shade", ((x, top + 70), (x + 14, top + 22),
                                         (x + width // 2, top), (x + width - 12, top + 22),
                                         (x + width, top + 70), (x + width - 24, top + 100),
                                         (x + 20, top + 100)))
    return im


def ravine_mid():
    im = image(720, 600)
    polygon(im, "zone-green-shade", ((0, 430), (130, 406), (218, 448), (288, 456),
                                     (348, 530), (408, 474), (490, 444), (610, 410),
                                     (719, 430), (719, 600), (0, 600)))
    polygon(im, "slate", ((0, 500), (112, 468), (218, 498), (288, 500), (348, 570),
                          (408, 518), (510, 478), (624, 472), (719, 500), (719, 600), (0, 600)))
    polygon(im, "zone-blue-shade", ((300, 600), (348, 554), (396, 600)))
    return im


def tree():
    im = image(96, 216)
    rect(im, "zone-peach-shade", (36, 60, 60, 216))
    rect(im, "zone-peach", (39, 78, 44, 204))
    polygon(im, SHADE, ((0, 74), (12, 28), (36, 4), (62, 4), (84, 30),
                           (95, 74), (84, 112), (60, 128), (28, 124), (8, 106)))
    polygon(im, "zone-green-shade", ((3, 74), (15, 30), (37, 8), (60, 8), (81, 32),
                                     (92, 74), (81, 108), (58, 124), (30, 120), (12, 104)))
    polygon(im, PRIMARY, ((6, 72), (18, 32), (38, 12), (58, 12), (78, 36),
                          (82, 68), (62, 92), (28, 94), (12, 86)))
    return im


def shrub():
    im = image(48, 48)
    polygon(im, SHADE, ((0, 46), (2, 24), (12, 14), (24, 18), (34, 10),
                           (44, 22), (47, 46)))
    polygon(im, "zone-green-shade", ((3, 44), (5, 26), (13, 18), (24, 22),
                                     (34, 14), (41, 24), (44, 44)))
    polygon(im, PRIMARY, ((5, 28), (13, 20), (24, 24), (34, 16), (40, 26), (30, 32), (14, 32)))
    return im


def rock():
    im = image(72, 72)
    polygon(im, "slate", ((0, 70), (4, 42), (20, 20), (44, 12), (62, 32), (71, 70)))
    polygon(im, "slate", ((4, 67), (8, 44), (22, 24), (43, 16), (59, 34), (67, 67)))
    polygon(im, "grey", ((8, 44), (22, 24), (43, 16), (51, 26), (32, 44)))
    return im


BACKDROPS = {
    "forest-mid": (forest_mid, "x"),
    "forest-shrub": (shrub, "x"),
    "forest-tree": (tree, "none"),
    "ravine-mid": (ravine_mid, "x"),
    "ravine-rock": (rock, "none"),
    "woodland-far": (far, "x"),
    "woodland-sky": (sky, "x"),
}


def build():
    os.makedirs("public/art/backdrops", exist_ok=True)
    entry = pixel.write_tileset(TILESET, tiles())
    pixel.update_manifest("tilesets", [entry])
    entries = []
    for key, (draw, repeat) in BACKDROPS.items():
        im = draw()
        im.save(f"public/art/backdrops/{key}.png")
        entries.append({"key": key, "png": f"backdrops/{key}.png", "width": im.width, "height": im.height,
                        "anchor": "bottom-left", "y": BOTTOM, "repeat": repeat})
    pixel.update_manifest("backdrops", entries)
    print("built", TILESET, "and", len(entries), "backdrops")


def context(skin):
    """Identical geometry with different skins; no simulation or stage-design assertion."""
    import json

    im = image(720, 720, PRIMARY)
    for key in ("woodland-sky", "woodland-far", "forest-mid" if skin == "forest" else "ravine-mid"):
        p = Image.open(f"public/art/backdrops/{key}.png").convert("RGBA")
        for x in range(0, 720, p.width):
            im.alpha_composite(p, (x, BOTTOM - p.height))
    if skin == "forest":
        im.alpha_composite(Image.open("public/art/backdrops/forest-tree.png").convert("RGBA"), (0, 384))
        for x in range(120, 240, 48):
            im.alpha_composite(Image.open("public/art/backdrops/forest-shrub.png").convert("RGBA"), (x, 552))
        ground, raised = "forest-ground", "root-stack"
    else:
        for x in range(432, 672, 48):
            im.alpha_composite(Image.open("public/art/backdrops/ravine-rock.png").convert("RGBA"), (x, 528))
        ground, raised = "ravine-ground", "stone-stack"
    ts = dict(tiles())

    def block(family, col, row, width, height):
        for y in range(height):
            for x in range(width):
                if y == 0:
                    suffix = "top-left" if x == 0 else "top-right" if x == width - 1 else \
                        "top-joint" if x % 2 else "top"
                else:
                    suffix = "face-left" if x == 0 else "face-right" if x == width - 1 else "face"
                im.alpha_composite(ts[f"{family}-{suffix}"], ((col + x) * T, (row + y) * T))
    block(ground, 0, 50, 60, 10)
    for c, r, w, h in ((20, 46, 6, 4), (31, 42, 7, 8), (44, 38, 7, 12)):
        block(raised, c, r, w, h)
    # Shared standable ledges and contact strips are loaded, not copied into the material pack.
    shared = json.load(open("public/art/tilesets/tiles-platforming.json"))
    shared_png = Image.open("public/art/tilesets/tiles-platforming.png").convert("RGBA")

    def shared_tile(name):
        i = shared["tiles"][name]
        return shared_png.crop((i % 8 * T, i // 8 * T, i % 8 * T + T, i // 8 * T + T))
    for c in range(12, 18):
        name = "one-way-ledge-left" if c == 12 else "one-way-ledge-right" if c == 17 else "one-way-ledge-middle"
        im.alpha_composite(shared_tile(name), (c * T, 44 * T))
    for c in range(31, 38):
        im.alpha_composite(shared_tile("hazard-right"), (38 * T, (42 + c - 31) * T))
    data = json.load(open("public/art/sprites/bird.json"))
    f = next(iter(data["frames"].values()))["frame"]
    bird = Image.open("public/art/sprites/bird.png").convert("RGBA").crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    im.alpha_composite(bird, (72, 558))
    return im.convert("RGB").crop((0, 360, 720, 720))


def preview(out):
    sheet = image(1456, 392, "ink")
    draw = ImageDraw.Draw(sheet)
    for i, (skin, label) in enumerate((("forest", "Forest paths / earth + roots"),
                                       ("ravine", "Ravine / bank + stone"))):
        x = 8 + i * 728
        draw.text((x, 6), label, fill=pixel.rgb("cream"))
        sheet.alpha_composite(context(skin).convert("RGBA"), (x, 24))
    sheet.convert("RGB").save(out)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit("Usage: woodland.py build | preview OUT.png")
