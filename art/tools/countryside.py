#!/usr/bin/env python3
"""Reusable countryside appearance skins, independent of layouts, collision and zone assignment.

Usage: countryside.py build | preview OUT.png. Run from repository root. Pillow, plain PNG, no animation.
Canonical countryside zone-yellow and its shade supply wheat atmosphere. Existing house colours supply
outlines, quiet foliage and water. No palette changes. Water is distant decoration, not a hazard surface.

Tiles-countryside: 12px, eight columns, 28 cells, 96x48. Families country-ground, hay-stack, riverbank,
timber-crossing each use top/top-left/top-right/top-joint/face/face-left/face-right. Same generic geometry
and collision as existing skins. Only top cells have dark edge and white safe lip. Existing shared ledges,
hazards and movers retain tiles-platforming. These are appearance packs, not zone-specific archetypes.

Backdrops bottom-left anchored at default y600: countryside-sky48x600 repeatx factor0,0;
countryside-far720x600 repeatx factor.15,.05; farmland-mid and river-mid720x600 repeatx factor.4,.15;
farmland-barn120x144 none, farmland-fence48x48 repeatx, river-reeds48x72 repeatx factor1,1.
Near decor aligns with local floor, has no collision, white safe lip or red hazard marking. Keep near
silhouettes clear of the route. Tonal silhouettes have no dark contour bands. No new actors, doors or mechanics.
Preview geometry is illustrative only.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
import zone_themes  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

T = 12
COLUMNS = 8
TILESET = "tiles-countryside"
BOTTOM = 600
PRIMARY = zone_themes.THEMES["countryside"]["primary"]
SHADE = PRIMARY + "-shade"
FAMILIES = ("country-ground", "hay-stack", "riverbank", "timber-crossing")
SUFFIXES = ("top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right")


def image(width, height, colour=None):
    return Image.new("RGBA", (width, height), pixel.rgb(colour) + (255,) if colour else (0, 0, 0, 0))


def rect(im, colour, box):
    im.paste(pixel.rgb(colour) + (255,), box)


def polygon(im, colour, points):
    ImageDraw.Draw(im).polygon(points, fill=pixel.rgb(colour) + (255,))


def material(family, suffix):
    fill = {"country-ground": SHADE, "hay-stack": SHADE,
            "riverbank": "zone-green-shade", "timber-crossing": "zone-peach-shade"}[family]
    im = image(T, T, fill)
    if family == "hay-stack":
        rect(im, PRIMARY, (0, 0, 12, 2))
        rect(im, "brown", (4, 0, 6, 12))
    elif family == "timber-crossing":
        rect(im, "brown", (0, 8, 12, 10))
        rect(im, "zone-yellow-shade", (0, 0, 2, 8))
    elif family == "country-ground":
        rect(im, "brown", (0, 8, 12, 10))
    if suffix.endswith("left"):
        rect(im, "dslate", (0, 0, 2, T))
    if suffix.endswith("right"):
        rect(im, "dslate", (10, 0, 12, T))
    if suffix.startswith("top"):
        rect(im, "navy", (0, 0, 12, 1))
        rect(im, "white", (0, 1, 12, 3))
        rect(im, PRIMARY if family != "riverbank" else "zone-green", (0, 3, 12, 5))
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
    polygon(im, SHADE, ((0, 430), (72, 408), (160, 420), (252, 388), (352, 414),
                       (454, 400), (568, 420), (648, 406), (719, 430), (719, 600), (0, 600)))
    return im


def farmland_mid():
    im = image(720, 600)
    polygon(im, "zone-green-shade", ((0, 468), (144, 444), (300, 466), (456, 438),
                                     (600, 454), (719, 468), (719, 600), (0, 600)))
    polygon(im, SHADE, ((0, 510), (210, 478), (390, 502), (540, 478), (719, 510), (719, 600), (0, 600)))
    for x, y, w in ((50, 502, 150), (290, 520, 170), (520, 502, 150)):
        rect(im, PRIMARY, (x, y, x + w, y + 14))
    polygon(im, "zone-peach-shade", ((520, 440), (548, 420), (576, 440), (576, 476), (520, 476)))
    return im


def river_mid():
    im = image(720, 600)
    polygon(im, "zone-green-shade", ((0, 460), (160, 444), (310, 474), (510, 448),
                                     (719, 460), (719, 600), (0, 600)))
    polygon(im, "zone-blue-shade", ((0, 520), (200, 496), (420, 520), (600, 498),
                                    (719, 520), (719, 600), (0, 600)))
    for x, y, w in ((30, 542, 120), (270, 526, 150), (520, 552, 160)):
        rect(im, "zone-blue", (x, y, x + w, y + 4))
    return im


def barn():
    im = image(120, 144)
    polygon(im, SHADE, ((0, 40), (60, 0), (119, 40), (119, 143), (0, 143)))
    polygon(im, PRIMARY, ((4, 42), (60, 6), (116, 42), (116, 140), (4, 140)))
    polygon(im, "brown", ((0, 40), (60, 0), (119, 40), (119, 48), (60, 12), (0, 48)))
    rect(im, PRIMARY, (6, 48, 114, 58))
    rect(im, "brown", (28, 68, 92, 144))
    rect(im, "zone-peach-shade", (32, 72, 88, 140))
    rect(im, "brown", (58, 72, 62, 140))
    polygon(im, "brown", ((32, 76), (36, 72), (88, 132), (88, 140)))
    rect(im, "brown", (48, 26, 72, 42))
    rect(im, PRIMARY, (52, 30, 68, 38))
    return im


def fence():
    im = image(48, 48)
    for y in (14, 28):
        rect(im, "brown", (0, y, 48, y + 6))
        rect(im, SHADE, (0, y, 48, y + 3))
    for x in (6, 30):
        rect(im, "brown", (x, 6, x + 8, 48))
        rect(im, "zone-peach-shade", (x + 2, 8, x + 6, 46))
    return im


def reeds():
    im = image(48, 72)
    for x, top in ((8, 22), (22, 8), (36, 30)):
        rect(im, "zone-green-shade", (x, top, x + 3, 72))
        polygon(im, "zone-green-shade", ((x, 64), (x - 7, top + 10), (x - 4, top + 8), (x + 3, 64)))
        polygon(im, "zone-green-shade", ((x, 68), (x + 8, top + 18), (x + 11, top + 20), (x + 3, 72)))
        rect(im, "brown", (x - 1, top - 6, x + 4, top + 5))
    return im


BACKDROPS = {
    "countryside-far": (far, "x"),
    "countryside-sky": (sky, "x"),
    "farmland-barn": (barn, "none"),
    "farmland-fence": (fence, "x"),
    "farmland-mid": (farmland_mid, "x"),
    "river-mid": (river_mid, "x"),
    "river-reeds": (reeds, "x"),
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
    for key in ("countryside-sky", "countryside-far", "farmland-mid" if skin == "farmland" else "river-mid"):
        p = Image.open(f"public/art/backdrops/{key}.png").convert("RGBA")
        for x in range(0, 720, p.width):
            im.alpha_composite(p, (x, BOTTOM - p.height))
    if skin == "farmland":
        im.alpha_composite(Image.open("public/art/backdrops/farmland-barn.png").convert("RGBA"), (0, 456))
        for x in range(120, 240, 48):
            im.alpha_composite(Image.open("public/art/backdrops/farmland-fence.png").convert("RGBA"), (x, 552))
        ground, raised = "country-ground", "hay-stack"
    else:
        for x in range(432, 672, 48):
            im.alpha_composite(Image.open("public/art/backdrops/river-reeds.png").convert("RGBA"), (x, 528))
        ground, raised = "riverbank", "timber-crossing"
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
    for i, (skin, label) in enumerate((("farmland", "Farmland / earth + bound hay"),
                                       ("river", "River crossing / bank + timber"))):
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
        raise SystemExit("Usage: countryside.py build | preview OUT.png")
