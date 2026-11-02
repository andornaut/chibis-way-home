"""Ordinary Use-room doors, 60x84 (5x7 tiles), with a 48px clear leaf, bottom anchored at the local floor.

Muted complete jambs enclose a blue glazed street door or a peach apartment panel door. Amber is confined
to a small handle. No arrow, text, continuous white safe lip, hazard red, collision or light data.
Existing non-door street tile indices and apartment stair markers retain their contracts.

Usage from the repository root:
  room_doors.py build             export the street tileset and apartment room-door backdrop only
  room_doors.py preview OUT.png   compare both doors with native Chibi on enclosed wall sections
"""

import importlib
import sys
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
pixel = importlib.import_module("pixel")
SIZE = (60, 84)


def door(style="street"):
    apartment = style == "apartment"
    leaf = "zone-peach" if apartment else "zone-blue-shade"
    panel = "zone-peach-shade" if apartment else "zone-blue"
    shade = "zone-peach-shade" if apartment else "slate"
    grid = pixel.Grid(*SIZE)
    for x, y, width, height, colour in (
        (0, 0, 60, 84, "grey"),
        (0, 0, 60, 3, "lgrey"),
        (0, 3, 3, 81, "lgrey"),
        (57, 3, 3, 81, "slate"),
        (4, 6, 52, 78, "dslate"),
        (6, 8, 48, 74, leaf),
        (6, 8, 48, 2, panel),
        (6, 10, 2, 70, panel),
        (52, 10, 2, 72, shade),
        (10, 15, 40, 27, shade),
        (12, 17, 36, 23, panel),
        (12, 17, 2, 19, "zone-red" if apartment else "lgrey"),
        (10, 50, 40, 25, shade),
        (12, 52, 36, 21, leaf),
        (46, 44, 5, 13, "dslate"),
        (47, 45, 3, 9, "amber"),
        (4, 82, 52, 2, "slate"),
    ):
        grid.rect(x, y, width, height, colour)
    return grid


def image(style="street"):
    grid = door(style)
    result = Image.new("RGBA", SIZE)
    for y, row in enumerate(grid.px):
        for x, colour in enumerate(row):
            if colour:
                result.putpixel((x, y), (*pixel.rgb(colour), 255))
    return result


def build():
    floor = importlib.import_module("floor1")
    wayfinding = importlib.import_module("apartment_wayfinding")
    tiles, pieces = floor.street_tiles_cool()
    entry = pixel.write_tileset("tiles-street", [(key, floor.frame_image(grid.px)) for key, grid in tiles], pieces)
    pixel.update_manifest("tilesets", [entry])
    image("apartment").save("public/art/backdrops/apartment-room-door.png")
    entries = [entry for entry in wayfinding.REGISTRY if entry["key"] == "apartment-room-door"]
    pixel.update_manifest("backdrops", entries)
    print("built street door 5x7 and apartment-room-door 60x84")


def preview(out):
    result = Image.new("RGBA", (720, 360), (*pixel.rgb("lgrey"), 255))
    for left, style, wall in ((0, "street", "zone-purple"), (360, "apartment", "zone-red")):
        result.paste((*pixel.rgb(wall), 255), (left, 0, left + 360, 252))
        result.paste((*pixel.rgb("grey"), 255), (left, 252, left + 360, 360))
        result.paste((*pixel.rgb("slate"), 255), (left, 252, left + 360, 254))
        result.alpha_composite(image(style), (left + 132, 168))
        bird = Image.open("public/art/sprites/bird.png").convert("RGBA").crop((0, 0, 48, 42))
        result.alpha_composite(bird, (left + 194, 210))
    result.save(out)
    stem = str(Path(out).with_suffix(""))
    ImageOps.grayscale(result).save(stem + "-grey.png")
    result.resize((864, 432), Image.Resampling.NEAREST).save(stem + "-phone.png")
    result.resize((2160, 1080), Image.Resampling.NEAREST).save(stem + "-3x.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit(__doc__)
