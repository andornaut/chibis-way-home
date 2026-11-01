"""Apartment wayfinding props, each 48x72, transparent and bottom-left anchored on the local floor.

Usage: apartment_wayfinding.py build | preview OUT.png
Run from the repository root. Build writes only the three backdrop PNGs; the parent owns manifest registration.

- apartment-stairwell: an open recess containing an ascending stepped silhouette, with a white up-arrow on a
  dslate sign. It identifies an automatic upstairs walking trigger, not a Use action or physical stair mechanic.
- apartment-stairwell-down: the same recess with a descending silhouette and a white down-arrow.
- apartment-room-door: a closed warm-panelled optional room door with amber framing and a small handle. No arrow.

Registry contract: each key uses backdrops/<key>.png, width 48, height 72, anchor bottom-left, y 720, repeat none.
There are no animation tags, collision boxes or light anchors. Place the frame bottom on the local floor.
Only real terrain carries a safe white lip; these props have no continuous white horizontal edge.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from PIL import Image, ImageOps

SIZE = (48, 72)
KEYS = ("apartment-room-door", "apartment-stairwell", "apartment-stairwell-down")
BACKDROPS = "public/art/backdrops"
REGISTRY = [
    {
        "key": key,
        "png": f"backdrops/{key}.png",
        "width": 48,
        "height": 72,
        "anchor": "bottom-left",
        "y": 720,
        "repeat": "none",
    }
    for key in KEYS
]


def rect(im, box, colour):
    im.paste((*pixel.rgb(colour), 255), box)


def canvas():
    return Image.new("RGBA", SIZE)


def stairwell(down=False):
    im = canvas()
    # Rose plaster jambs surround an open, cool recess rather than a closed door leaf.
    for box, colour in (
        ((3, 4, 45, 72), "dbrown"),
        ((4, 5, 44, 72), "zone-red-shade"),
        ((7, 8, 41, 72), "navy"),
        ((8, 9, 40, 72), "dslate"),
        ((8, 10, 11, 72), "slate"),
        ((39, 10, 41, 72), "ink"),
    ):
        rect(im, box, colour)
    # Quiet broad steps rise into the recess; they have no bright standable lip.
    if down:
        for x, y in ((9, 40), (16, 48), (23, 56), (30, 64)):
            rect(im, (x, y, min(x + 7, 40), 72), "grey")
            rect(im, (x, y, min(x + 7, 40), y + 2), "slate")
    else:
        for x, y in ((9, 64), (16, 56), (23, 48), (30, 40)):
            rect(im, (x, y, 40, 72), "grey")
            rect(im, (x, y, 40, y + 2), "slate")
    rect(im, (14, 4, 39, 29), "navy")
    rect(im, (15, 5, 38, 28), "dslate")
    # A compact directional arrow, separated from the architecture by a dark sign.
    if down:
        rect(im, (24, 10, 29, 19), "white")
        for y, half in ((18, 6), (19, 5), (20, 4), (21, 3), (22, 2), (23, 1)):
            rect(im, (26 - half, y, 27 + half, y + 1), "white")
    else:
        for y, half in ((10, 1), (11, 2), (12, 3), (13, 4), (14, 5), (15, 6)):
            rect(im, (26 - half, y, 27 + half, y + 1), "white")
        rect(im, (24, 15, 29, 24), "white")
    return im


def room_door():
    im = canvas()
    for box, colour in (
        ((5, 10, 43, 72), "dbrown"),
        ((6, 11, 42, 72), "ochre"),
        ((7, 12, 10, 72), "amber"),
        ((10, 12, 39, 15), "amber"),
        ((10, 15, 39, 72), "dbrown"),
        ((12, 17, 37, 72), "tan"),
        ((13, 18, 15, 70), "skin1"),
        ((33, 18, 37, 72), "brown"),
        ((17, 24, 31, 41), "brown"),
        ((18, 25, 30, 40), "skin1"),
        ((17, 48, 31, 65), "brown"),
        ((18, 49, 30, 64), "skin1"),
        ((32, 43, 35, 50), "dbrown"),
        ((31, 44, 35, 47), "amber"),
    ):
        rect(im, box, colour)
    return im


def images():
    return {
        "apartment-room-door": room_door(),
        "apartment-stairwell": stairwell(),
        "apartment-stairwell-down": stairwell(down=True),
    }


def build():
    Path(BACKDROPS).mkdir(parents=True, exist_ok=True)
    for key, im in images().items():
        im.save(f"{BACKDROPS}/{key}.png")


def preview(out):
    im = Image.new("RGBA", (720, 360), (*pixel.rgb("zone-red"), 255))
    for x in range(0, 720, 144):
        rect(im, (x, 48, x + 2, 252), "zone-red-shade")
    rect(im, (0, 244, 720, 252), "zone-red-shade")
    rect(im, (0, 252, 720, 360), "dbrown")
    # The bright edge below belongs to actual floor terrain, never either backdrop.
    rect(im, (0, 252, 720, 253), "plum")
    rect(im, (0, 253, 720, 255), "cream")
    for key, x in (("apartment-stairwell", 180), ("apartment-stairwell-down", 336), ("apartment-room-door", 492)):
        im.alpha_composite(images()[key], (x, 180))
    bird = Image.open("public/art/sprites/bird.png").convert("RGBA").crop((0, 0, 48, 42))
    im.alpha_composite(bird, (260, 210))
    im.save(out)
    stem = str(Path(out).with_suffix(""))
    ImageOps.grayscale(im).save(stem + "-grey.png")
    im.resize((864, 432), Image.Resampling.NEAREST).save(stem + "-phone.png")
    im.resize((2160, 1080), Image.Resampling.NEAREST).save(stem + "-3x.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit("Usage: apartment_wayfinding.py build | preview OUT.png")
