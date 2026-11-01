"""The game's muted powder-blue wordmark and canonical cream bird, built from reusable pixel shapes.

Usage, from the repository root:
  python3 -I art/tools/logo.py build            write the three logos and update their manifest image entries
  python3 -I art/tools/logo.py preview OUT.png  each logo on pale steel and navy at 1x and 3x

All images have transparent backgrounds and binary alpha. Canvas sizes and stable keys:
- logo: 558x239, full cream bird standing on a simple platform above flat Chibi's / Way Home lettering.
- logo-nav: 226x30, compact full bird beside Chibi's Way Home on one line.
- logo-icon: 53x41, full bird standing on a short powder-blue platform, with no lettering.

WORDMARK supplies the title. GLYPHS is the 5x7 alphabet. Lettering uses zone-blue over a flat dark-steel sign,
with one quiet light
edge and a dark outline, without extrusion, cyan highlights or drop shadows. Bird shapes come from the protagonist
drawing module;
the cream body, tan wing, orange bill and dot eye retain the protagonist's identity on both backgrounds.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bird as bird_art
import pixel
from PIL import Image, ImageDraw
from pixel import Grid, K

WORDMARK = ("Chibi's", "Way Home")
OUT = {"logo": "public/art/logo.png", "logo-nav": "public/art/logo-nav.png", "logo-icon": "public/art/logo-icon.png"}

GLYPHS = {
    "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "a": [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
    "b": ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "####."],
    "e": [".....", ".....", ".###.", "#...#", "#####", "#....", ".####"],
    "h": ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "#...#"],
    "i": ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."],
    "m": [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#...#", "#...#"],
    "o": [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
    "s": [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
    "y": [".....", ".....", "#...#", "#...#", ".####", "....#", ".###."],
}

BIG = {"b": 11, "fill": "zone-blue", "light": "lgrey"}
SMALL = {"b": 9, "fill": "zone-blue", "light": "lgrey"}
NAV = {"b": 2, "fill": "zone-blue", "light": "zone-blue"}
CANVASES = {"logo": (558, 239), "logo-nav": (226, 30), "logo-icon": (53, 41)}


def image(px):

    h, w = len(px), len(px[0])
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), (*pixel.rgb(c), 255))
    return im


def word(text, b, fill, light):
    """Flat 5x7 lettering: one dark outline and a single upper-left light edge at larger sizes."""
    gap = b
    cw = 5 * b + gap
    width, height = len(text) * cw - gap + 2, 7 * b + 2
    mask = set()
    for i, ch in enumerate(text):
        if ch == " ":
            continue
        for gy, row in enumerate(GLYPHS[ch]):
            for gx, c in enumerate(row):
                if c == "#":
                    mask.update((1 + i * cw + gx * b + x, 1 + gy * b + y) for y in range(b) for x in range(b))
    g = Grid(width, height)
    for x, y in sorted(mask):
        rim = b >= 3 and ((x - 1, y) not in mask or (x, y - 1) not in mask)
        g.p(x, y, light if rim else fill)
    return image(g.outlined(lambda _c: K["ink"]))


def canvas(key):

    return Image.new("RGBA", CANVASES[key], (0, 0, 0, 0))


def platform(im, x, y, width):
    """A restrained flat ledge: powder-blue face, light top and dark lower edge."""

    d = ImageDraw.Draw(im)
    d.rectangle((x, y, x + width - 1, y + 3), fill=(*pixel.rgb("ink"), 255))
    d.line((x + 1, y, x + width - 2, y), fill=(*pixel.rgb("lgrey"), 255))
    d.rectangle((x + 1, y + 1, x + width - 2, y + 2), fill=(*pixel.rgb("zone-blue"), 255))


def bird_at(s, pose="rest"):
    """The bird's side view redrawn at s times its size: every shape scales, the outline and rim
    stay 1px. pose is "rest" (standing, wing folded) or "downstroke" (in the air, the wing level behind her,
    feet tucked under her belly)."""
    width, height = round(bird_art.W * s), round(bird_art.H * s)
    g = Grid(width, height)
    centre = width / 2
    bw, bh = bird_art.BRX * s, bird_art.BRY * s
    air = pose == "downstroke"
    bottom = height - 1 - 2 * round(2 * s) if air else bird_art.BODY_BOTTOM * s
    bcy = bottom - bh
    hr = bird_art.HEAD_R * s
    hcx, hcy = centre + bird_art.HEAD_X * bw, bcy - bird_art.HEAD_UP * bh
    fw, fh = round(4 * s), round(2 * s)
    if not air:
        g.rect(int(centre - 5 * s), height - 1 - fh, fw, fh, "orange")
    bird_art.cel(
        g,
        bird_art.in_ell(centre - bw + s, bcy - s, 4.4 * s, 2.2 * s, -0.45),
        bird_art.BASE,
        bird_art.SHADE,
        None,
        round(s),
        1,
    )
    bird_art.cel(
        g,
        bird_art.in_body(centre, bcy, bw, bh, hcx - hr * 0.7, bird_art.NAPE_DROP * s, bird_art.BACK_FLAT * s),
        bird_art.BASE,
        bird_art.SHADE,
        bird_art.LIGHT,
        round(3 * s),
        1,
    )
    if air:
        for dx in (-5, 2):
            g.rect(int(centre + dx * s), int(bottom), fw, round(s), "orange")
        a, ln = math.radians(172), 15 * s
        sx, sy = centre - 5 * s, bcy - bh * 0.45
        bird_art.flat(
            g,
            bird_art.in_ell(sx + math.cos(a) * ln * 0.5, sy + math.sin(a) * ln * 0.5, ln * 0.5, ln * 0.27, a),
            bird_art.WING,
        )
    else:
        g.rect(int(centre + 2 * s), height - 1 - fh, fw, fh, "orange")
    bird_art.cel(g, bird_art.in_ell(hcx, hcy, hr, hr), bird_art.BASE, bird_art.SHADE, bird_art.LIGHT, round(3 * s), 1)
    if not air:
        bird_art.flat(g, bird_art.in_ell(centre - 2 * s, bcy + 2 * s, bw * 0.5, bh * 0.3, -0.3), bird_art.WING)
    g.rect(int(hcx + hr - 2 * s), int(hcy), round(7 * s), round(5 * s), "orange")
    g.rect(int(hcx), int(hcy - hr * 0.55), round(4 * s), round(4 * s), "ink")
    return image(g.outlined(lambda _c: K[bird_art.OUTLINE]))


def logo():
    im = canvas("logo")
    d = bird_at(1.6)
    d = d.crop(d.getbbox())
    im.alpha_composite(d, ((im.width - d.width) // 2, 74 - d.height))

    draw = ImageDraw.Draw(im)
    draw.rectangle((35, 76, 522, 238), fill=(*pixel.rgb("ink"), 255))
    draw.rectangle((36, 77, 521, 237), fill=(*pixel.rgb("dslate"), 255))
    platform(im, (im.width - 210) // 2, 74, 210)
    for text, spec, y in ((WORDMARK[0], BIG, 82), (" ".join(WORDMARK[1:]), SMALL, 168)):
        line = word(text, **spec)
        im.alpha_composite(line, ((im.width - line.width) // 2, y))
    return im


def logo_nav():
    im = canvas("logo-nav")
    d = bird_at(0.65)
    d = d.crop(d.getbbox())
    im.alpha_composite(d, (0, (im.height - d.height) // 2))
    line = word(" ".join(WORDMARK), **NAV)

    draw = ImageDraw.Draw(im)
    draw.rectangle((31, 6, im.width - 1, 23), fill=(*pixel.rgb("dslate"), 255))
    im.alpha_composite(line, (32, (im.height - line.height) // 2))
    return im


def logo_icon():
    im = canvas("logo-icon")
    d = bird_at(0.85)
    d = d.crop(d.getbbox())
    im.alpha_composite(d, ((im.width - d.width) // 2, 37 - d.height))
    platform(im, 4, 37, 45)
    return im


def images():
    return {"logo": logo(), "logo-nav": logo_nav(), "logo-icon": logo_icon()}


def build():
    ims = images()
    for key, im in ims.items():
        Path(str(Path(OUT[key]).parent)).mkdir(parents=True, exist_ok=True)
        im.save(OUT[key])
    manifest = {}
    if Path(pixel.MANIFEST).exists():
        with Path(pixel.MANIFEST).open() as f:
            manifest = json.load(f)
    entries = {e["key"]: e for e in manifest.get("images", [])}
    for key, im in ims.items():
        entries[key] = {"key": key, "png": Path(OUT[key]).name, "width": im.width, "height": im.height}
    manifest["images"] = sorted(entries.values(), key=lambda e: e["key"])
    with Path(pixel.MANIFEST).open("w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(f"{k} {im.width}x{im.height}" for k, im in ims.items()))


def preview(out):

    ims = images()
    tiles = []
    for ground in ("lgrey", "navy"):
        for z in (1, 3):
            for im in ims.values():
                t = Image.new("RGBA", (im.width + 16, im.height + 16), (*pixel.rgb(ground), 255))
                t.alpha_composite(im, (8, 8))
                tiles.append(t.resize((t.width * z, t.height * z), Image.NEAREST))
    width = max(t.width for t in tiles)
    sheet = Image.new("RGB", (width, sum(t.height for t in tiles)), pixel.rgb("ink"))
    y = 0
    for t in tiles:
        sheet.paste(t.convert("RGB"), (0, y))
        y += t.height
    sheet.save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
