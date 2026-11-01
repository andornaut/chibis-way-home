"""Rasterize the game's two pixel fonts into BMFonts (XML .fnt plus a PNG atlas).

- font-body: Tiny5 at 8px, mixed case, for body text, dialogue and quips. Line height 10 (ascent 7, descent 2,
  1 leading): capitals sit on rows 2 to 6 of the line box, descenders reach row 7.
- font-title: Silkscreen at 8px, capitals, for titles, names and buttons. Line height 12 (ascent 9, descent 2,
  1 leading): capitals sit on rows 4 to 8 of the line box and columns 1 onward of the advance.

The game draws both at 2x, so body lines step 20 base pixels and capitals are 10 base pixels tall. Glyphs are
white on transparent, fully opaque, so the game tints them. Printable ASCII and the middle dot (U+00B7), which
both fonts carry as a 1px dot on the capitals' middle row: advance 2 in font-body and 3 in font-title (4 and 6 at
2x). It comes after ASCII, so every other glyph keeps its place in the atlas.

Both are SIL Open Font License fonts; the font files and licenses are in art/fonts/.

Usage:
  fonts.py preview OUT.png   a sample of both fonts, scaled up
  fonts.py build             write public/art/fonts/<key>.png and .fnt and list them in the manifest's "fonts"

Run from the repository root.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from art_kit.fonts import FontInfo, bmfont_xml, rasterize
from art_kit.fonts import pack as pack_glyphs
from PIL import Image

FONTS = {
    "font-body": ("Tiny5", "art/fonts/tiny5/Tiny5.ttf", 8),
    "font-title": ("Silkscreen", "art/fonts/silkscreen/Silkscreen-Regular.ttf", 8),
}
OUT = "public/art/fonts"
CHARS = [chr(c) for c in range(32, 127)] + ["\u00b7"]
ATLAS_W = 128


def glyphs(path, size):
    return rasterize(path, size, CHARS)


def pack(gl):
    return pack_glyphs(ATLAS_W, gl)


def build_font(key, face, path, size):
    gl, ascent, descent = glyphs(path, size)
    atlas, places = pack(gl)
    Path(OUT).mkdir(parents=True, exist_ok=True)
    atlas.save(f"{OUT}/{key}.png")
    info = FontInfo(key, face, size, ascent + descent + 1, ascent)
    with Path(f"{OUT}/{key}.fnt").open("w") as f:
        f.write(bmfont_xml(info, atlas.size, places, gl))


def build():
    for key, (face, path, size) in FONTS.items():
        build_font(key, face, path, size)
    manifest = {}
    if Path(pixel.MANIFEST).exists():
        with Path(pixel.MANIFEST).open() as f:
            manifest = json.load(f)
    entries = {f["key"]: f for f in manifest.get("fonts", [])}
    for key in FONTS:
        entries[key] = {"key": key, "png": f"fonts/{key}.png", "fnt": f"fonts/{key}.fnt"}
    manifest["fonts"] = sorted(entries.values(), key=lambda f: f["key"])
    Path(str(Path(pixel.MANIFEST).parent)).mkdir(parents=True, exist_ok=True)
    with Path(pixel.MANIFEST).open("w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(FONTS))


def preview(out, scale=3):
    """Both fonts at 2x on the dialogue box navy, then scaled up for viewing."""
    samples = [
        "BIRD  SKIP  SETTINGS  RESUME",
        "The quick brown bird flutters down.",
        "Touch controls: Shown, Hidden",
        "0123456789 !?.,:;'\"+-/%&()",
    ]
    sheet = Image.new("RGB", (330, (12 * len(samples) + 8) * len(FONTS)), pixel.rgb("navy"))
    y = 4
    for _face, path, size in FONTS.values():
        gl, _, _ = glyphs(path, size)
        for s in samples:
            x = 4
            for ch in s:
                im, ox, oy, adv = gl.get(ch, gl["?"])
                if im is not None:
                    sheet.paste(pixel.rgb("cream"), (x + ox, y + oy), im)
                x += adv
            y += 12
        y += 8
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST).save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
