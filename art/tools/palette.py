"""Write the house and zone palettes and their ramps as data for the game: public/art/palette.json.

Shape (every key sorted, colours as lower-case "#rrggbb", the file ending with a newline):

  {
    "colours": {"amber": "#feae34", ...},   every palette colour by its K name in art/tools/pixel.py
    "darker": {"#181425": "#181425", ...},  each colour one ramp step down
    "dim2": {"#181425": "#181425", ...}     each colour two ramp steps down: the settings card's dim
  }

The game dims the frame behind the settings card by replacing each colour with its "dim2" entry, so it never
chains lookups. Ink is the bottom of every ramp and maps to itself.

The manifest lists it under "data" as {"key": "palette", "json": "palette.json"}.

Usage:
  palette.py build             write public/art/palette.json and list it in the manifest
  palette.py preview OUT.png   each colour beside its one- and two-step darker colours, scaled up

Run from the repository root.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from PIL import Image, ImageDraw

OUT = "public/art/palette.json"


def data():
    def h(c):
        return "#" + pixel.hexc(c)

    return {
        "colours": {name: h(c) for name, c in pixel.K.items()},
        "darker": {h(c): h(pixel.darker(c)) for c in pixel.PALETTE},
        "dim2": {h(c): h(pixel.darker(c, 2)) for c in pixel.PALETTE},
    }


def build():
    Path(str(Path(OUT).parent)).mkdir(parents=True, exist_ok=True)
    with Path(OUT).open("w") as f:
        json.dump(data(), f, indent=2, sort_keys=True)
        f.write("\n")
    manifest = {}
    if Path(pixel.MANIFEST).exists():
        with Path(pixel.MANIFEST).open() as f:
            manifest = json.load(f)
    entries = {d["key"]: d for d in manifest.get("data", [])}
    entries["palette"] = {"key": "palette", "json": Path(OUT).name}
    manifest["data"] = sorted(entries.values(), key=lambda d: d["key"])
    with Path(pixel.MANIFEST).open("w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built palette")


def preview(out, cell=24, gap=4):
    """One row per colour: the colour, then one and two ramp steps down."""

    names = sorted(pixel.K, key=lambda n: pixel.PALETTE.index(pixel.K[n]))
    img = Image.new("RGB", (3 * (cell + gap) + gap, len(names) * (cell + gap) + gap), pixel.rgb("slate"))
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        for j, c in enumerate((pixel.K[n], pixel.darker(n), pixel.darker(n, 2))):
            x, y = gap + j * (cell + gap), gap + i * (cell + gap)
            d.rectangle((x, y, x + cell - 1, y + cell - 1), fill=pixel.rgb(c))
    img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
