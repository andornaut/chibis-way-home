"""Reusable industrial appearance pack, independent of layouts, collision and zone assignment.

Usage: industrial.py build | preview OUT.png
Run from the repository root. Pillow only; outputs are plain PNG backdrops and a tileset, not animations.

The primary and shade come from the industrial destination in zone_themes.py. Existing house colours
supply steel outlines, muted wood and safe white lips. No palette values or existing art are changed.

Tiles: tiles-industrial, 12px, eight columns, 28 cells in a 96x48 PNG. Each material has seven keys:
top, top-left, top-right, top-joint, face, face-left and face-right. Families, in export order:
- industrial-floor: concrete; warehouse ground look.
- crate-stack: muted wooden packing cases; warehouse raised look.
- terminal-floor: steel/concrete apron; freight ground look.
- container-stack: corrugated lavender steel; freight raised look.
The suffixes are the same rendering semantics for every family. These are skins, not new archetypes.
Top tiles alone carry the dark edge and white walkable lip. Shared one-way ledges, red hazard strips
and movers keep tiles-platforming; this pack does not duplicate their artwork or behaviour.

Backdrops, bottom-left anchored at default y600:
- industrial-sky: 48x600, repeat x; flat smoky lavender, suggested scroll factor0,0.
- industrial-far: 720x600, repeat x; distant window-free factories and tanks, factor0.15,0.05.
- warehouse-mid: 720x600, repeat x; low sawtooth warehouses, factor0.4,0.15.
- freight-mid: 720x600, repeat x; distant container stacks and service cranes, factor0.4,0.15.
- warehouse-wall: 48x240, repeat x; broad panels and quiet transom windows, factor1,1.
- warehouse-loading-bay: 120x144, no repeat; closed roller door, factor1,1.
- freight-gantry: 144x192, no repeat; posts and an overhead service beam, factor1,1.
Near pieces align to the local floor. They have no collision or white safe lips; place their beam and
post silhouettes clear of the route. Existing street-door art supplies room entrances independently.

The preview compares Warehouse and Freight terminal on identical illustrative geometry at720x360,
with the native tileset exported separately. This is not a validated stage or reachability claim.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import json

import pixel
import zone_themes
from PIL import Image, ImageDraw

T = 12
COLUMNS = 8
TILESET = "tiles-industrial"
BOTTOM = 600
PRIMARY = zone_themes.THEMES["industrial"]["primary"]
SHADE = PRIMARY + "-shade"
FAMILIES = ("industrial-floor", "crate-stack", "terminal-floor", "container-stack")
SUFFIXES = ("top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right")


def image(width, height, colour=None):
    return Image.new("RGBA", (width, height), (*pixel.rgb(colour), 255) if colour else (0, 0, 0, 0))


def rect(im, colour, box):
    im.paste((*pixel.rgb(colour), 255), box)


def line(im, colour, width, points):
    ImageDraw.Draw(im).line(points, fill=(*pixel.rgb(colour), 255), width=width)


def polygon(im, colour, points):
    ImageDraw.Draw(im).polygon(points, fill=(*pixel.rgb(colour), 255))


def material(family, suffix):
    fill = {
        "industrial-floor": SHADE,
        "crate-stack": "zone-peach-shade",
        "terminal-floor": "slate",
        "container-stack": PRIMARY,
    }[family]
    im = image(T, T, fill)
    if family == "crate-stack":
        rect(im, "zone-red-shade", (0, 0, 2, 12))
        rect(im, "zone-red-shade", (0, 0, 12, 2))
    elif family == "container-stack":
        rect(im, SHADE, (0, 0, 2, 12))
    if suffix.endswith("left"):
        rect(im, "dslate", (0, 0, 2, T))
    if suffix.endswith("right"):
        rect(im, "dslate", (10, 0, 12, T))
    if suffix.startswith("top"):
        top = {
            "industrial-floor": PRIMARY,
            "crate-stack": "zone-peach",
            "terminal-floor": "grey",
            "container-stack": SHADE,
        }[family]
        rect(im, "navy", (0, 0, T, 1))
        rect(im, "white", (0, 1, T, 3))
        rect(im, top, (0, 3, T, 5))
        if suffix == "top-joint":
            rect(im, "dslate", (10, 3, 12, 7))
    return im


def tiles():
    return [(f"{family}-{suffix}", material(family, suffix)) for family in FAMILIES for suffix in SUFFIXES]


def sky():
    return image(48, 600, PRIMARY)


def far():
    im = image(720, 600)
    # Broad factory halls, a few attached stacks and tanks, without window grids or contour bands.
    for x, width, top in ((12, 144, 366), (196, 126, 332), (370, 156, 384), (568, 136, 350)):
        rect(im, SHADE, (x, top, x + width, 600))
        rect(im, SHADE, (x + 16, top - 14, x + width - 16, top))
    for x, top in ((62, 270), (238, 248), (620, 282)):
        rect(im, SHADE, (x, top, x + 14, 430))
        rect(im, SHADE, (x - 2, top, x + 16, top + 6))
    for x, top in ((144, 398), (510, 410)):
        ImageDraw.Draw(im).ellipse((x, top, x + 42, top + 22), fill=(*pixel.rgb(SHADE), 255))
        rect(im, SHADE, (x, top + 11, x + 43, 600))
    return im


def warehouse_mid():
    im = image(720, 600)
    for x, width, top in ((12, 192, 456), (258, 144, 426), (468, 228, 466)):
        rect(im, "slate", (x, top, x + width, 600))
        for start in range(x, x + width, 48):
            polygon(im, "slate", ((start, top), (start + 38, top - 20), (start + 48, top)))
        rect(im, SHADE, (x + 12, top + 26, x + width - 12, top + 38))
        rect(im, "zone-purple-shade", (x + width - 24, top + 38, x + width - 12, 600))
    return im


def freight_mid():
    im = image(720, 600)
    for x, width, top in ((18, 168, 510), (238, 144, 474), (446, 240, 522)):
        rect(im, "slate", (x, top, x + width, 600))
        rect(im, SHADE, (x, top, x + width, top + 4))
        for y in range(top + 42, 600, 42):
            rect(im, SHADE, (x, y, x + width, y + 2))
    for x, top in ((118, 388), (478, 362)):
        rect(im, "slate", (x, top, x + 10, 600))
        rect(im, "slate", (x + 120, top, x + 130, 600))
        rect(im, "slate", (x - 8, top, x + 142, top + 14))
        polygon(im, "slate", ((x + 10, top), (x + 64, top - 32), (x + 120, top)))
        rect(im, "slate", (x + 68, top + 14, x + 70, top + 64))
    return im


def warehouse_wall():
    im = image(48, 240, SHADE)
    rect(im, "slate", (0, 0, 48, 8))
    rect(im, "dslate", (0, 8, 3, 240))
    rect(im, PRIMARY, (3, 8, 5, 232))
    rect(im, "slate", (43, 8, 48, 240))
    rect(im, "dslate", (8, 28, 40, 60))
    rect(im, PRIMARY, (10, 30, 38, 58))
    rect(im, "slate", (23, 30, 25, 58))
    rect(im, "slate", (10, 44, 38, 46))
    rect(im, "slate", (5, 146, 43, 150))
    rect(im, "dslate", (0, 230, 48, 240))
    return im


def loading_bay():
    im = image(120, 144, SHADE)
    rect(im, "slate", (2, 4, 118, 144))
    rect(im, "dslate", (8, 16, 112, 144))
    rect(im, "slate", (12, 20, 108, 144))
    for y in range(24, 140, 12):
        rect(im, "dslate", (12, y, 108, y + 2))
        rect(im, SHADE, (12, y + 2, 108, y + 4))
    rect(im, "dslate", (12, 136, 108, 144))
    rect(im, "grey", (54, 126, 66, 130))
    rect(im, PRIMARY, (2, 4, 6, 140))
    rect(im, "dslate", (114, 4, 118, 144))
    return im


def gantry():
    im = image(144, 192)
    rect(im, "dslate", (6, 14, 18, 192))
    rect(im, SHADE, (9, 20, 15, 186))
    rect(im, "dslate", (126, 14, 138, 192))
    rect(im, SHADE, (129, 20, 135, 186))
    rect(im, "dslate", (0, 8, 144, 28))
    rect(im, PRIMARY, (4, 12, 140, 24))
    for x in range(14, 132, 24):
        polygon(im, "slate", ((x, 12), (x + 10, 24), (x + 16, 24), (x + 6, 12)))
    rect(im, "dslate", (0, 184, 24, 192))
    rect(im, "dslate", (120, 184, 144, 192))
    rect(im, "slate", (60, 28, 84, 42))
    rect(im, "dslate", (71, 42, 73, 78))
    rect(im, "dslate", (66, 76, 78, 80))
    return im


BACKDROPS = {
    "freight-gantry": (gantry, "none"),
    "freight-mid": (freight_mid, "x"),
    "industrial-far": (far, "x"),
    "industrial-sky": (sky, "x"),
    "warehouse-loading-bay": (loading_bay, "none"),
    "warehouse-mid": (warehouse_mid, "x"),
    "warehouse-wall": (warehouse_wall, "x"),
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
    for key in ("industrial-sky", "industrial-far", "warehouse-mid" if skin == "warehouse" else "freight-mid"):
        p = Image.open(f"public/art/backdrops/{key}.png").convert("RGBA")
        for x in range(0, 720, p.width):
            im.alpha_composite(p, (x, BOTTOM - p.height))
    if skin == "warehouse":
        wall = Image.open("public/art/backdrops/warehouse-wall.png").convert("RGBA")
        for x in range(0, 240, 48):
            im.alpha_composite(wall, (x, BOTTOM - wall.height))
        im.alpha_composite(Image.open("public/art/backdrops/warehouse-loading-bay.png").convert("RGBA"), (0, 456))
        ground, raised = "industrial-floor", "crate-stack"
    else:
        im.alpha_composite(Image.open("public/art/backdrops/freight-gantry.png").convert("RGBA"), (432, 408))
        ground, raised = "terminal-floor", "container-stack"
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
        (
            ("warehouse", "Warehouse / concrete + muted wooden crates"),
            ("freight", "Freight terminal / apron + corrugated containers"),
        )
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
        raise SystemExit("Usage: industrial.py build | preview OUT.png")
