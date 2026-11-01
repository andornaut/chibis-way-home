"""Neutral reusable stage-transition illustration, 720x360, fully opaque, with no baked text or controls.

Usage: cutscene.py build | preview OUT.png
Run from the repository root. Build writes public/art/images/stage-cutscene-placeholder.png only.

CLEANUP (added 2026-10-31): retain this neutral illustration until authored stage cutscenes are approved.

Registry key stage-cutscene-placeholder: image, width 720, height 360. Draw at viewport origin (0,0).
Quiet lgrey/grey abstract blocks frame the canonical cream bird standing on a real safe floor edge. No plot,
place, event or additional character is depicted. The bottom 80px remains plain for a runtime Continue action.
The bird's existing idle frame is copied without recolouring, resizing or redrawing. No tags or collision.
Preview overlays the existing primary button and font-body label; neither is included in the served image.
"""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from PIL import Image, ImageDraw, ImageOps

KEY = "stage-cutscene-placeholder"
OUT = f"public/art/images/{KEY}.png"
SIZE = (720, 360)
REGISTRY = {"key": KEY, "png": f"images/{KEY}.png", "width": 720, "height": 360}


def sprite(key, tag):
    with Path(f"public/art/sprites/{key}.json").open() as f:
        data = json.load(f)
    frame_id = next(t["from"] for t in data["meta"]["frameTags"] if t["name"] == tag)
    frame = list(data["frames"].values())[frame_id]["frame"]
    sheet = Image.open(f"public/art/sprites/{key}.png").convert("RGBA")
    x, y, w, h = (frame[n] for n in ("x", "y", "w", "h"))
    return sheet.crop((x, y, x + w, y + h))


def illustration():
    im = Image.new("RGBA", SIZE, (*pixel.rgb("lgrey"), 255))
    draw = ImageDraw.Draw(im)
    # Broad neutral blocks suggest depth without depicting a new destination or story prop.
    for box in ((0, 142, 112, 247), (58, 102, 156, 247), (560, 118, 656, 247), (624, 160, 719, 247)):
        draw.rounded_rectangle(box, radius=10, fill=(*pixel.rgb("grey"), 255))
    for box in ((0, 218, 184, 247), (536, 218, 719, 247)):
        draw.rounded_rectangle(box, radius=6, fill=(*pixel.rgb("slate"), 255))
    # Shared safe-edge grammar: one dark edge and two light pixels over the solid floor.
    draw.rectangle((0, 248, 719, 359), fill=(*pixel.rgb("slate"), 255))
    draw.rectangle((0, 248, 719, 248), fill=(*pixel.rgb("navy"), 255))
    draw.rectangle((0, 249, 719, 250), fill=(*pixel.rgb("white"), 255))
    draw.rectangle((0, 251, 719, 254), fill=(*pixel.rgb("grey"), 255))
    bird = sprite("bird", "idle")
    im.alpha_composite(bird, (336, 248 - bird.height))
    return im


def build():
    Path(str(Path(OUT).parent)).mkdir(parents=True, exist_ok=True)
    illustration().save(OUT)


def button(im, box):
    src = sprite("ui-button-primary", "normal")
    x, y, width, height = box
    sx, sy = (0, 2, 14, 16), (0, 4, 22, 28)
    dx, dy = (x, x + 2, x + width - 2, x + width), (y, y + 4, y + height - 6, y + height)
    for row in range(3):
        for col in range(3):
            piece = src.crop((sx[col], sy[row], sx[col + 1], sy[row + 1]))
            piece = piece.resize((dx[col + 1] - dx[col], dy[row + 1] - dy[row]), Image.Resampling.NEAREST)
            im.alpha_composite(piece, (dx[col], dy[row]))
    # Preview-only existing action label, never exported in the backdrop.
    chars = {
        int(c.attrib["id"]): {k: int(v) for k, v in c.attrib.items()}
        for c in ET.parse("public/art/fonts/font-body.fnt").findall("chars/char")  # noqa: S314 - Fixed local BMFont export.
    }
    atlas = Image.open("public/art/fonts/font-body.png").convert("RGBA")
    label = "Continue"
    width = sum(chars[ord(c)]["xadvance"] for c in label) * 2 - 2
    cursor = x + (box[2] - width) // 2
    for c in label:
        f = chars[ord(c)]
        glyph = atlas.crop((f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"]))
        glyph = glyph.resize((glyph.width * 2, glyph.height * 2), Image.Resampling.NEAREST)
        im.alpha_composite(glyph, (cursor + f["xoffset"] * 2, y + 13 + f["yoffset"] * 2))
        cursor += f["xadvance"] * 2


def preview(out):
    im = illustration()
    button(im, (280, 296, 160, 48))
    im.save(out)
    stem = str(Path(out).with_suffix(""))
    ImageOps.grayscale(im).save(stem + "-grey.png")
    im.resize((864, 432), Image.Resampling.NEAREST).save(stem + "-phone.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        raise SystemExit("Usage: cutscene.py build | preview OUT.png")
