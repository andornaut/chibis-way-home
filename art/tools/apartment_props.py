"""Reusable decorative apartment furnishings at the canonical bird scale.

Usage: apartment_props.py build | preview OUT.png, from the repository root. Pillow, plain PNG exports.
Ten bottom-left backdrops default to world y720. Only pool-water repeats x; its horizontal edges match.
All props are decorative with no collision, white walkable lip, hazard paint, characters or text.
Physical platforms and doors remain separately placed objects. Pool water has no lethal behaviour.
Zone-red rose ties the rooms together with quiet wood, sage and blue accents from the existing palette.
The preview is a furniture contact sheet beside the 48x42 bird, not a proposed level layout.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from PIL import Image, ImageDraw

SIZES = {
    "restaurant-counter": (96, 48),
    "restaurant-booth": (72, 48),
    "pool-water": (96, 24),
    "pool-bench": (72, 36),
    "spa-screen": (72, 96),
    "spa-bench": (72, 36),
    "residential-shelf": (72, 96),
    "lobby-desk": (96, 48),
    "lobby-sofa": (96, 48),
    "lobby-plant": (36, 60),
}


def rect(im, colour, box):
    im.paste((*pixel.rgb(colour), 255), box)


def ellipse(im, colour, box):
    ImageDraw.Draw(im).ellipse(box, fill=(*pixel.rgb(colour), 255))


def legs(im, xs, top, bottom):
    for x in xs:
        rect(im, "dbrown", (x, top, x + 4, bottom))
        rect(im, "zone-peach-shade", (x + 1, top, x + 3, bottom - 1))


def draw(kind):
    w, h = SIZES[kind]
    im = Image.new("RGBA", (w, h))
    if kind in ("restaurant-counter", "lobby-desk"):
        rect(im, "dbrown", (2, 10, 94, 48))
        rect(im, "zone-peach-shade", (5, 15, 91, 44))
        rect(im, "zone-red-shade", (8, 18, 88, 40))
        for x in (32, 62):
            rect(im, "dbrown", (x, 18, x + 2, 40))
        rect(im, "brown", (0, 8, 96, 15))
        rect(im, "zone-peach", (2, 9, 94, 12))
        if kind == "restaurant-counter":
            ellipse(im, "zone-peach", (12, 4, 34, 10))
            ellipse(im, "zone-peach-shade", (16, 6, 30, 9))
            rect(im, "zone-green-shade", (70, 1, 78, 8))
        else:
            rect(im, "zone-blue-shade", (64, 1, 82, 8))
            rect(im, "dslate", (62, 6, 84, 9))
    elif kind in ("restaurant-booth", "lobby-sofa"):
        legs(im, (8, w - 12), 39, 48)
        rect(im, "dbrown", (3, 2, w - 3, 38))
        rect(im, "zone-red-shade", (5, 4, w - 5, 34))
        rect(im, "zone-red", (8, 5, w - 8, 25))
        rect(im, "zone-red", (4, 29, w - 4, 38))
        rect(im, "zone-red-shade", (4, 38, w - 4, 42))
        rect(im, "zone-red-shade", (w // 2 - 1, 6, w // 2 + 1, 24))
        if kind == "lobby-sofa":
            for x in (1, w - 13):
                rect(im, "dbrown", (x, 19, x + 12, 41))
                rect(im, "zone-red-shade", (x + 2, 20, x + 10, 38))
    elif kind == "pool-water":
        rect(im, "zone-blue-shade", (0, 0, 96, 24))
        rect(im, "zone-blue", (0, 3, 96, 21))
        rect(im, "zone-blue-shade", (0, 11, 96, 13))
        for x in (8, 40, 72):
            rect(im, "zone-blue-shade", (x, 6, x + 16, 8))
            rect(im, "zone-blue-shade", (x + 8, 17, x + 22, 19))
    elif kind in ("pool-bench", "spa-bench"):
        legs(im, (7, 61), 22, 36)
        wood = "zone-peach" if kind == "spa-bench" else "zone-green"
        shade = wood + "-shade"
        rect(im, "dbrown", (2, 8, 70, 25))
        for y in (10, 17):
            rect(im, shade, (4, y, 68, y + 5))
            rect(im, wood, (5, y, 67, y + 2))
        if kind == "spa-bench":
            rect(im, "zone-green-shade", (45, 3, 64, 9))
            rect(im, "zone-green", (46, 3, 63, 6))
    elif kind == "spa-screen":
        for x, top, bottom in ((0, 8, 96), (24, 0, 90), (48, 8, 96)):
            rect(im, "dbrown", (x + 1, top, x + 23, bottom))
            rect(im, "zone-peach-shade", (x + 3, top + 3, x + 21, bottom - 8))
            rect(im, "zone-green", (x + 5, top + 5, x + 19, bottom - 11))
            for y in range(top + 18, bottom - 10, 18):
                rect(im, "zone-green-shade", (x + 5, y, x + 19, y + 2))
    elif kind == "residential-shelf":
        rect(im, "dbrown", (4, 0, 68, 96))
        rect(im, "zone-peach-shade", (8, 4, 64, 92))
        for y in (26, 56, 86):
            rect(im, "brown", (8, y, 64, y + 4))
        for x, y, height, colour in (
            (12, 7, 19, "zone-red"),
            (21, 12, 14, "zone-green"),
            (31, 6, 20, "zone-blue-shade"),
            (43, 38, 18, "zone-red-shade"),
        ):
            rect(im, colour, (x, y, x + 7, y + height))
        ellipse(im, "zone-peach", (13, 39, 32, 55))
        rect(im, "zone-green-shade", (16, 70, 40, 86))
        rect(im, "zone-green", (16, 70, 40, 74))
    elif kind == "lobby-plant":
        d = ImageDraw.Draw(im)
        for tip, side in (((5, 8), -1), ((29, 3), 1), ((3, 24), -1), ((32, 26), 1)):
            d.line(((18, 42), tip), fill=pixel.rgb("zone-green-shade"), width=2)
            x, y = tip
            d.polygon(
                ((x, y), (x + side * 3, y + 8), (18, y + 16), (x - side * 3, y + 4)), fill=pixel.rgb("zone-green-shade")
            )
            d.polygon(((x, y + 2), (x - side * 2, y + 5), (17, y + 14)), fill=pixel.rgb("zone-green"))
        ImageDraw.Draw(im).polygon(((5, 40), (31, 40), (27, 59), (9, 59)), fill=pixel.rgb("dbrown"))
        ImageDraw.Draw(im).polygon(((7, 42), (29, 42), (25, 57), (11, 57)), fill=pixel.rgb("zone-red-shade"))
        rect(im, "zone-red", (4, 39, 32, 44))
    return im


def registry():
    return [
        {
            "key": "apartment-" + key,
            "png": "backdrops/apartment-" + key + ".png",
            "width": size[0],
            "height": size[1],
            "anchor": "bottom-left",
            "y": 720,
            "repeat": "x" if key == "pool-water" else "none",
        }
        for key, size in SIZES.items()
    ]


def build():
    Path("public/art/backdrops").mkdir(parents=True, exist_ok=True)
    for key in SIZES:
        draw(key).save("public/art/backdrops/apartment-" + key + ".png")


def preview(out):
    im = Image.new("RGB", (720, 480), pixel.rgb("zone-red"))
    bird = Image.open("public/art/sprites/bird.png").convert("RGBA").crop((0, 0, 48, 42))
    for i, key in enumerate(SIZES):
        x, y = i % 5 * 144, i // 5 * 240
        rect(im, "zone-red-shade", (x + 4, y + 32, x + 140, y + 204))
        rect(im, "dbrown", (x + 4, y + 204, x + 140, y + 207))
        prop = draw(key)
        im.paste(prop, (x + 8, y + 204 - prop.height), prop)
        im.paste(bird, (x + 94, y + 162), bird)
        ImageDraw.Draw(im).text((x + 5, y + 212), key.replace("-", "\n"), fill=pixel.rgb("ink"))
    im.save(out)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit(__doc__)
