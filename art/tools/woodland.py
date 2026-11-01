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
Large overlapping far and middle canopies span the upper texture bands; trunks extend to the base.
Birch and conifer far/middle variants retain720x600/repeatx/bottom600 and the same parallax contracts.
No actors or natural hidden lethality. Context uses identical illustrative geometry, not validated stages.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import json

import nature
import pixel
import zone_themes
from PIL import Image, ImageDraw

T = 12
COLUMNS = 8
TILESET = "tiles-woodland"
BOTTOM = 600
PRIMARY = zone_themes.THEMES["woodland"]["primary"]
SHADE = PRIMARY + "-shade"
FAMILIES = ("forest-ground", "root-stack", "ravine-ground", "stone-stack")
SUFFIXES = ("top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right")


def image(width, height, colour=None):
    return Image.new("RGBA", (width, height), (*pixel.rgb(colour), 255) if colour else (0, 0, 0, 0))


def rect(im, colour, box):
    im.paste((*pixel.rgb(colour), 255), box)


def polygon(im, colour, points):
    ImageDraw.Draw(im).polygon(points, fill=(*pixel.rgb(colour), 255))


def material(family, suffix):
    fill = {
        "forest-ground": "zone-green-shade",
        "root-stack": "zone-yellow-shade",
        "ravine-ground": "slate",
        "stone-stack": "grey",
    }[family]
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
    return [(f"{family}-{suffix}", material(family, suffix)) for family in FAMILIES for suffix in SUFFIXES]


def sky():
    return image(48, 600, PRIMARY)


def woodland_mass(im, x, top, width, height, colour, trunk_width):
    """Large irregular broadleaf crowns on branching trunks, wrapped at the repeat boundary."""
    for shift in (-720, 0, 720):
        nature.broadleaf(im, x + shift, top, width, height, 600, colour, colour, trunk_width, seed=int(x) % 11)


def far():
    im = image(720, 600)
    # Continuous overlapping forest canopy, with trunks visible down to the texture's base.
    for x, top, width, height in (
        (-60, 34, 190, 242),
        (76, 8, 204, 272),
        (224, 48, 182, 238),
        (352, 18, 208, 264),
        (504, 46, 192, 242),
        (636, 12, 196, 268),
    ):
        woodland_mass(im, x, top, width, height, SHADE, 18)
    return im


def forest_mid():
    im = image(720, 600)
    # Large near-middle trees overlap the distant canopy without a decorative contour band.
    for x, top, width, height in (
        (-84, 144, 236, 232),
        (110, 108, 224, 254),
        (304, 164, 242, 230),
        (506, 126, 244, 252),
    ):
        woodland_mass(im, x, top, width, height, "forest", 30)
    return im


def ravine_mid():
    im = image(720, 600)
    # Dense bank-side woods frame the ravine; its central opening remains visually open.
    for x, top, width in ((-62, 116, 236), (558, 132, 230)):
        woodland_mass(im, x, top, width, 242, "forest", 26)
    polygon(
        im,
        SHADE,
        (
            (0, 450),
            (124, 428),
            (212, 458),
            (274, 470),
            (350, 542),
            (422, 478),
            (514, 444),
            (626, 432),
            (719, 450),
            (719, 600),
            (0, 600),
        ),
    )
    polygon(
        im,
        "slate",
        (
            (0, 510),
            (106, 482),
            (208, 510),
            (274, 514),
            (350, 584),
            (422, 532),
            (510, 494),
            (628, 486),
            (719, 510),
            (719, 600),
            (0, 600),
        ),
    )
    polygon(im, "zone-blue-shade", ((312, 600), (350, 568), (388, 600)))
    return im


def conifers(middle=False):
    """Natural tapered spruce crowns with irregular drooping boughs and connected trunks."""
    im = image(720, 600)
    colour = "forest" if middle else SHADE
    for x, source_top, source_width in (
        (-40, 28, 156),
        (92, 68, 136),
        (206, 12, 172),
        (356, 50, 148),
        (482, 22, 174),
        (632, 62, 142),
    ):
        top, width = source_top, source_width
        if middle:
            top += 62
        for shift in (-720, 0, 720):
            nature.spruce(im, x + shift, top, width, 300, 600, colour, colour, seed=int(x) % 7)
    return im


def birches(middle=False):
    """High irregular leafy crowns above slender pale, forked and sparsely marked birch trunks."""
    im = image(720, 600)
    crown = "forest" if middle else SHADE
    for x, source_top, source_width in (
        (-38, 18, 158),
        (104, 52, 146),
        (226, 6, 166),
        (378, 38, 152),
        (510, 16, 160),
        (652, 54, 140),
    ):
        top, width = source_top, source_width
        if middle:
            top += 20
            width = int(width * 0.76)
        for shift in (-720, 0, 720):
            left = x + shift
            nature.broadleaf(
                im,
                left,
                top,
                width,
                150 if middle else 208,
                600,
                crown,
                "lgrey" if middle else SHADE,
                9,
                seed=int(x) % 11,
            )
            if middle:
                centre = left + width * 0.52
                for y in range(top + 160, 590, 46):
                    rect(im, "slate", (int(centre) - 2, y, int(centre) + 2, y + 2))
    return im


def tree():
    im = image(96, 216)
    nature.broadleaf(im, 1, 4, 92, 148, 216, SHADE, "zone-peach-shade", 14, seed=3)
    return im


def shrub():
    im = image(48, 48)
    for x in (8, 18, 31, 40):
        nature.branch(im, SHADE, (24, 48), (x, 18 + x % 7), 3)
    for x, y, width, height, seed in ((0, 18, 28, 24, 2), (17, 10, 29, 31, 5), (8, 28, 36, 20, 8)):
        nature.leaves(im, SHADE, (x, y, width, height), seed)
    nature.leaves(im, PRIMARY, (19, 12, 19, 18), 7)
    return im


def rock():
    im = image(72, 72)
    polygon(im, "slate", ((0, 70), (4, 42), (20, 20), (44, 12), (62, 32), (71, 70)))
    polygon(im, "slate", ((4, 67), (8, 44), (22, 24), (43, 16), (59, 34), (67, 67)))
    polygon(im, "grey", ((8, 44), (22, 24), (43, 16), (51, 26), (32, 44)))
    return im


BACKDROPS = {
    "forest-mid": (forest_mid, "x"),
    "forest-mid-birch": (lambda: birches(True), "x"),
    "forest-mid-conifers": (lambda: conifers(True), "x"),
    "forest-shrub": (shrub, "x"),
    "forest-tree": (tree, "none"),
    "ravine-mid": (ravine_mid, "x"),
    "ravine-rock": (rock, "none"),
    "woodland-far": (far, "x"),
    "woodland-far-birch": (birches, "x"),
    "woodland-far-conifers": (conifers, "x"),
    "woodland-sky": (sky, "x"),
}


def build():
    Path("public/art/backdrops").mkdir(parents=True, exist_ok=True)
    entry = pixel.write_tileset(TILESET, tiles())
    pixel.update_manifest("tilesets", [entry])
    entries = []
    for key, (draw, repeat) in BACKDROPS.items():
        im = draw()
        im.save(f"public/art/backdrops/{key}.png")
        entries.append(
            {
                "key": key,
                "png": f"backdrops/{key}.png",
                "width": im.width,
                "height": im.height,
                "anchor": "bottom-left",
                "y": BOTTOM,
                "repeat": repeat,
            }
        )
    pixel.update_manifest("backdrops", entries)
    print("built", TILESET, "and", len(entries), "backdrops")


def context(skin):
    """Identical geometry with different skins; no simulation or stage-design assertion."""

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
                    suffix = (
                        "top-left" if x == 0 else "top-right" if x == width - 1 else "top-joint" if x % 2 else "top"
                    )
                else:
                    suffix = "face-left" if x == 0 else "face-right" if x == width - 1 else "face"
                im.alpha_composite(ts[f"{family}-{suffix}"], ((col + x) * T, (row + y) * T))

    block(ground, 0, 50, 60, 10)
    for c, r, w, h in ((20, 46, 6, 4), (31, 42, 7, 8), (44, 38, 7, 12)):
        block(raised, c, r, w, h)
    # Shared standable ledges and contact strips are loaded, not copied into the material pack.
    shared = json.loads(Path("public/art/tilesets/tiles-platforming.json").read_text())
    shared_png = Image.open("public/art/tilesets/tiles-platforming.png").convert("RGBA")

    def shared_tile(name):
        i = shared["tiles"][name]
        return shared_png.crop((i % 8 * T, i // 8 * T, i % 8 * T + T, i // 8 * T + T))

    for c in range(12, 18):
        name = "one-way-ledge-left" if c == 12 else "one-way-ledge-right" if c == 17 else "one-way-ledge-middle"
        im.alpha_composite(shared_tile(name), (c * T, 44 * T))
    for c in range(31, 38):
        im.alpha_composite(shared_tile("hazard-right"), (38 * T, (42 + c - 31) * T))
    data = json.loads(Path("public/art/sprites/bird.json").read_text())
    f = next(iter(data["frames"].values()))["frame"]
    bird = (
        Image.open("public/art/sprites/bird.png")
        .convert("RGBA")
        .crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    )
    im.alpha_composite(bird, (72, 558))
    return im.convert("RGB").crop((0, 360, 720, 720))


def preview(out):
    sheet = image(1456, 392, "ink")
    draw = ImageDraw.Draw(sheet)
    for i, (skin, label) in enumerate(
        (("forest", "Forest paths / earth + roots"), ("ravine", "Ravine / bank + stone"))
    ):
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
