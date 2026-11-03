"""Complete outdoor building masses behind existing ordinary room entrances.

Usage: room_buildings.py build | preview OUT.png, from the repository root.
Five static 180x180 (15x15 tile) backdrops: room-building-blue-cityscape, room-building-industrial,
room-building-countryside, room-building-woodland and room-building-home-city. Bottom-left, default y600,
repeat none. The transparent local opening is x60,y96,w60,h84, matching the existing 60x84 room door.
Place the facade at door col-5,row-8, on the same 1,1 world plane behind the interactive door; both bottoms
meet the actual supporting terrain. No collision, safe lip, input prompt, animation, lights or baked door.
Indoor entrances reuse solid themed room walls and trim rather than these exterior buildings.
"""

import importlib
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
pixel = importlib.import_module("pixel")
SIZE = (180, 180)
OPENING = (60, 96, 120, 180)
STYLES = {
    "blue-cityscape": ("street", False),
    "industrial": ("industrial", False),
    "countryside": ("countryside", True),
    "woodland": ("woodland", True),
    "home-city": ("homecity", False),
}
OUT = Path("public/art/backdrops")


def draw(style):
    zone, gable = STYLES[style]
    base = "bg-" + zone + "-near"
    shade = base + "-shade"
    light = base + "-light"
    roof = "bg-woodland-near-wood" if style == "woodland" else shade
    image = Image.new("RGBA", SIZE)
    paint = ImageDraw.Draw(image)

    def rectangle(box, colour):
        image.paste((*pixel.rgb(colour), 255), box)

    if gable:
        paint.polygon(((0, 52), (90, 0), (179, 52)), fill=(*pixel.rgb(roof), 255))
        paint.polygon(((10, 52), (90, 12), (169, 52)), fill=(*pixel.rgb(light), 255))
        rectangle((8, 52, 172, 180), base)
        rectangle((8, 58, 12, 180), light)
        rectangle((168, 58, 172, 180), shade)
        rectangle((0, 50, 180, 58), roof)
    else:
        rectangle((0, 0, 180, 180), base)
        rectangle((0, 0, 180, 12), roof)
        rectangle((2, 3, 178, 7), light)
        rectangle((0, 12, 8, 180), light)
        rectangle((172, 12, 180, 180), shade)
        rectangle((8, 88, 172, 92), shade)
    for x in (16, 132):
        rectangle((x, 104, x + 32, 144), shade)
        rectangle((x + 2, 106, x + 30, 142), light)
        rectangle((x + 15, 106, x + 17, 142), base)
        rectangle((x + 2, 122, x + 30, 124), base)
        rectangle((x - 2, 144, x + 34, 148), shade)
    image.paste((0, 0, 0, 0), OPENING)
    return image


def registry():
    return [
        {
            "key": "room-building-" + style,
            "png": "backdrops/room-building-" + style + ".png",
            "width": SIZE[0],
            "height": SIZE[1],
            "anchor": "bottom-left",
            "y": 600,
            "repeat": "none",
        }
        for style in STYLES
    ]


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    for style in STYLES:
        draw(style).save(OUT / f"room-building-{style}.png")
    pixel.update_manifest("backdrops", registry())
    print("built", len(STYLES), "room entrance buildings")


def preview(out):
    doors = importlib.import_module("room_doors")
    result = Image.new("RGBA", (960, 228), (*pixel.rgb("lgrey"), 255))
    for i, style in enumerate(STYLES):
        x = 6 + i * 192
        result.alpha_composite(draw(style), (x, 24))
        result.alpha_composite(doors.image(), (x + OPENING[0], 24 + OPENING[1]))
        bird = Image.open("public/art/sprites/bird.png").convert("RGBA").crop((0, 0, 48, 42))
        result.alpha_composite(bird, (x + 128, 162))
    result.save(out)
    stem = str(Path(out).with_suffix(""))
    ImageOps.grayscale(result).save(stem + "-grey.png")
    result.resize((1152, 274), Image.Resampling.NEAREST).save(stem + "-phone.png")
    result.resize((2880, 684), Image.Resampling.NEAREST).save(stem + "-3x.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit(__doc__)
