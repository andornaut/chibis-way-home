"""Static start-screen background: opaque 720x360, top-left origin, no repeat or animation.

Seven low outer skyline silhouettes leave the logo and action field clear. A single ground band
anchors the scene. The existing lgrey, zone-blue and zone-blue-shade palette colours are used directly,
without ambient dimming. This image has no collision or light data and does not alter the homepage.

Usage from the repository root:
  start.py build             write the PNG and update its manifest image entry
  start.py preview OUT.png   show the background at 3x nearest-neighbour scale
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = (720, 360)
KEY = "start-background"
OUT = Path("public/art/images/start-background.png")
MANIFEST = Path("public/art/manifest.json")
PALETTE = Path("public/art/palette.json")
GROUND_Y = 332
SKYLINE = (
    (0, 277, 48),
    (48, 290, 34),
    (82, 266, 35),
    (117, 297, 44),
    (586, 294, 35),
    (621, 275, 49),
    (670, 288, 50),
)


def background():
    colours = json.loads(PALETTE.read_text(encoding="utf-8"))["colours"]
    image = Image.new("RGBA", SIZE, colours["lgrey"])
    draw = ImageDraw.Draw(image)
    for x, y, width in SKYLINE:
        draw.rectangle((x, y, x + width - 1, GROUND_Y - 1), fill=colours["zone-blue"])
    draw.rectangle((0, GROUND_Y, SIZE[0] - 1, SIZE[1] - 1), fill=colours["zone-blue-shade"])
    return image


def build():
    image = background()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = {entry["key"]: entry for entry in manifest.get("images", [])}
    entries[KEY] = {
        "key": KEY,
        "png": OUT.relative_to(MANIFEST.parent).as_posix(),
        "width": SIZE[0],
        "height": SIZE[1],
    }
    manifest["images"] = sorted(entries.values(), key=lambda entry: entry["key"])
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"built {KEY} {SIZE[0]}x{SIZE[1]}")


def preview(out):
    background().resize((SIZE[0] * 3, SIZE[1] * 3), Image.Resampling.NEAREST).save(out)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit(__doc__)
