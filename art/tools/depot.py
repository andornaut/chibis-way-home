#!/usr/bin/env python3
"""Static parcel-depot modules in the street's blue-grey palette.

Usage: depot.py build | preview OUT.png
Run from the repository root. Build writes three plain PNG backdrops and merges their manifest entries.
Pillow is required; these static backdrops have no Aseprite sources, animation tags or collision.

- depot-wall: 48x180, repeat x, bottom-left y 600. Corrugated slate wall, subdued grey ribs and dark base.
- depot-loading-bay: 120x120, no repeat, bottom-left y 600. Raised roller shutter over a dark opening, with
  a cream parcel icon on a navy plaque. The opening is scenery, not a room door or a platform.
- parcel-open: 72x36, no repeat, bottom-left y 600. Warm cardboard with open side flaps, a dark interior and
  a brown front, behind the cream bird. Nonlethal scenery, with no light walkable lip.

All three share the gameplay plane's scroll factor (1, 1). Positions and terrain belong to game data.
The illustrative preview uses a 720px depot wall, one bay at x 360, the parcel at x 24 and ground y 600.
It shows the bird at centre x 60, then clear of the parcel at centre x 132. It makes no physics claim.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

BACKDROPS = "public/art/backdrops"
FLOOR_Y = 600


def rect(draw, colour, box):
    draw.rectangle(box, fill=pixel.rgb(colour))


def wall():
    im = Image.new("RGBA", (48, 180))
    draw = ImageDraw.Draw(im)
    rect(draw, "slate", (0, 0, 47, 179))
    for x in (0, 16, 32):
        rect(draw, "dslate", (x, 5, x + 1, 179))
        rect(draw, "grey", (x + 2, 5, x + 3, 179))
    rect(draw, "dslate", (0, 0, 47, 7))
    rect(draw, "grey", (0, 2, 47, 3))
    rect(draw, "dslate", (0, 172, 47, 179))
    return im


def loading_bay():
    im = Image.new("RGBA", (120, 120))
    draw = ImageDraw.Draw(im)
    rect(draw, "slate", (0, 0, 119, 119))
    rect(draw, "navy", (4, 28, 115, 119))
    rect(draw, "dslate", (8, 32, 111, 119))
    rect(draw, "navy", (8, 100, 111, 119))
    rect(draw, "grey", (4, 24, 115, 49))
    for y in (28, 36, 44):
        rect(draw, "slate", (6, y, 113, y + 1))
    rect(draw, "dslate", (0, 24, 5, 119))
    rect(draw, "dslate", (114, 24, 119, 119))
    rect(draw, "grey", (4, 112, 9, 119))
    rect(draw, "grey", (110, 112, 115, 119))
    rect(draw, "navy", (40, 0, 79, 23))
    x, y = 50, 1
    draw.line([(x, y + 4), (x + 10, y), (x + 20, y + 4), (x + 10, y + 9), (x, y + 4),
               (x, y + 16), (x + 10, y + 21), (x + 20, y + 16), (x + 20, y + 4)],
              fill=pixel.rgb("cream"), width=2)
    draw.line([(x + 10, y + 9), (x + 10, y + 21)], fill=pixel.rgb("cream"), width=2)
    return im


def parcel():
    im = Image.new("RGBA", (72, 36))
    draw = ImageDraw.Draw(im)
    draw.polygon([(9, 12), (17, 4), (55, 4), (63, 12), (63, 34), (9, 34)], fill=pixel.rgb("dbrown"))
    draw.polygon([(12, 12), (18, 7), (54, 7), (60, 12), (54, 19), (18, 19)], fill=pixel.rgb("plum"))
    draw.polygon([(9, 12), (0, 4), (8, 1), (25, 10), (18, 19)],
                 fill=pixel.rgb("tan"), outline=pixel.rgb("dbrown"))
    draw.polygon([(63, 12), (71, 3), (62, 0), (47, 10), (54, 19)],
                 fill=pixel.rgb("tan"), outline=pixel.rgb("dbrown"))
    draw.polygon([(10, 20), (35, 24), (61, 20), (61, 34), (10, 34)],
                 fill=pixel.rgb("brown"), outline=pixel.rgb("dbrown"))
    rect(draw, "tan", (32, 24, 36, 33))
    rect(draw, "cream", (15, 24, 24, 28))
    return im


def assets():
    return {
        "depot-loading-bay": (loading_bay(), "none"),
        "depot-wall": (wall(), "x"),
        "parcel-open": (parcel(), "none"),
    }


def build():
    os.makedirs(BACKDROPS, exist_ok=True)
    entries = []
    for key, (im, repeat) in assets().items():
        im.save(f"{BACKDROPS}/{key}.png")
        entries.append({"key": key, "png": f"backdrops/{key}.png", "width": im.width, "height": im.height,
                        "anchor": "bottom-left", "y": FLOOR_Y, "repeat": repeat})
    pixel.update_manifest("backdrops", entries)
    print("built", ", ".join(assets()))


def sprite(key):
    path = f"public/art/sprites/{key}"
    with open(path + ".json") as source:
        frame = next(iter(json.load(source)["frames"].values()))["frame"]
    im = Image.open(path + ".png").convert("RGBA")
    x, y, w, h = (frame[name] for name in ("x", "y", "w", "h"))
    return im.crop((x, y, x + w, y + h))


def context(bird_centre=60):
    import floor1

    im = Image.new("RGBA", (720, 720), pixel.rgb("lgrey") + (255,))
    floor1.compose(im, floor1.BACKDROP_DEFS,
                   [(key, 0, 720, FLOOR_Y) for key in ("street-sky", "street-city-far", "street-city-mid")], [])
    wall_im = Image.open(f"{BACKDROPS}/depot-wall.png").convert("RGBA")
    bay_im = Image.open(f"{BACKDROPS}/depot-loading-bay.png").convert("RGBA")
    parcel_im = Image.open(f"{BACKDROPS}/parcel-open.png").convert("RGBA")
    for x in range(0, 720, wall_im.width):
        im.alpha_composite(wall_im, (x, FLOOR_Y - wall_im.height))
    im.alpha_composite(bay_im, (360, FLOOR_Y - bay_im.height))
    tiles = {name: floor1.frame_image(g.px) for name, g in floor1.street_tiles_cool()[0]}
    for row in range(50, 60):
        for col in range(60):
            key = ("sidewalk-top-joint" if col % 2 else "sidewalk-top") if row == 50 else "sidewalk-face"
            im.alpha_composite(tiles[key], (col * 12, row * 12))
    im.alpha_composite(parcel_im, (24, FLOOR_Y - parcel_im.height))
    bird = sprite("bird")
    im.alpha_composite(bird, (bird_centre - bird.width // 2, FLOOR_Y - bird.height))
    return im.convert("RGB")


def preview(out):
    sheet = Image.new("RGB", (1456, 752), pixel.rgb("ink"))
    draw = ImageDraw.Draw(sheet)
    for i, (centre, label) in enumerate(((60, "Start: parcel x24, bird centre x60"),
                                        (132, "Bird clear of the opened parcel"))):
        x = 8 + i * 728
        draw.text((x, 6), label, fill=pixel.rgb("cream"))
        sheet.paste(context(centre), (x, 28))
    sheet.save(out)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit("Usage: depot.py build | preview OUT.png")
