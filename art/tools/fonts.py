"""Build the two native 16px Liberation Sans BMFonts from bundled SIL OFL fonts.

font-body uses Liberation Sans Regular for body text, dialogue and quips.
font-title uses Liberation Sans Bold for headings, names and action labels.
Both draw at native 1x. Their 15px ascent and 4px descent give base15 and
lineHeight20 with one pixel of leading. The exported FNT metrics own layout.
Printable ASCII and the middle dot cover current player text. Native glyph
bearings and rounded pair kerning are retained. White RGBA glyphs use grayscale
alpha for tinting; font textures require linear sampling independently of art.

Usage: fonts.py build | preview OUT.png, from the repository root.
Build writes public/art/fonts/<key>.png and XML .fnt, retaining the two keys.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from art_kit.fonts import FontInfo, bmfont_xml, rasterize
from art_kit.fonts import pack as pack_glyphs
from PIL import Image, ImageFont

FONTS = {
    "font-body": ("Liberation Sans Regular", "art/fonts/liberation/LiberationSans-Regular.ttf", 16),
    "font-title": ("Liberation Sans Bold", "art/fonts/liberation/LiberationSans-Bold.ttf", 16),
}
OUT = "public/art/fonts"
CHARS = [chr(c) for c in range(32, 127)] + ["\u00b7"]
ATLAS_W = 256


def glyphs(size, path):
    return rasterize(path, size, CHARS, antialias=True)


def kernings(size, path):
    font = ImageFont.truetype(path, size)
    advances = {char: font.getlength(char) for char in CHARS}
    return [
        (first, second, amount)
        for first in CHARS
        for second in CHARS
        if (amount := round(font.getlength(first + second) - advances[first] - advances[second]))
    ]


def build_font(key, face, size, path):
    gl, ascent, descent = glyphs(size, path)
    atlas, places = pack_glyphs(ATLAS_W, gl)
    Path(OUT).mkdir(parents=True, exist_ok=True)
    atlas.save(f"{OUT}/{key}.png")
    info = FontInfo(key, face, size, ascent + descent + 1, ascent)
    with Path(f"{OUT}/{key}.fnt").open("w") as output:
        output.write(bmfont_xml(info, atlas.size, places, gl, kernings=kernings(size, path), antialias=True))


def build():
    for key, (face, path, size) in FONTS.items():
        build_font(key, face, size, path)
    entries = [{"key": key, "png": f"fonts/{key}.png", "fnt": f"fonts/{key}.fnt"} for key in FONTS]
    pixel.update_manifest("fonts", entries)
    print("built", ", ".join(FONTS))


def draw_line(gl, pairs, position, sheet, text):
    x, y = position
    previous = None
    for char in text:
        if previous is not None:
            x += pairs.get((previous, char), 0)
        image, ox, oy, advance = gl[char]
        if image is not None:
            tinted = Image.new("RGBA", image.size, (*pixel.rgb("cream"), 255))
            tinted.putalpha(image.getchannel("A"))
            sheet.alpha_composite(tinted, (x + ox, y + oy))
        x += advance
        previous = char


def preview(scale, out):
    samples = [
        "Chibi  Archie  Fert  Trixi  Bini  Pebble  Kiwi",
        "Try again  Back to title  Continue",
        "Whole run: 02:34.56 \u00b7 Deaths: 3 \u00b7 Stages: 2/6",
        "j _ w AV To Wy 0123456789 !?.,:;'\"+-/%&()",
    ]
    sheet = Image.new("RGBA", (720, len(FONTS) * 112), (*pixel.rgb("navy"), 255))
    y = 4
    for face, path, size in FONTS.values():
        gl, ascent, descent = glyphs(size, path)
        pairs = {(a, b): amount for a, b, amount in kernings(size, path)}
        for text in [face, *samples]:
            draw_line(gl, pairs, (8, y), sheet, text)
            y += ascent + descent + 1
        y += 12
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST).save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(3, sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
