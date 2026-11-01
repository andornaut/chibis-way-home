"""The site's favicon and app icons: the bird on a muted powder-blue sunburst disc.

Usage, from the repository root:
  python3 -I art/tools/icons.py build            write every icon below
  python3 -I art/tools/icons.py preview OUT.png  every icon at 1x on light and dark ground, the 16 and 32 at 8x

Plain PNGs (and one ICO), not Aseprite sprites and not manifest entries. Every pixel is fully opaque or
fully transparent. She is drawn from the sprite's shapes in art/tools/bird.py at each icon's own size, so each
drawing is its own rasterization rather than a downscale: the round cream head set into the body, the nape dip,
the softened back, the tail tip, a flat tan wing, a square ink dot eye and the short orange bill, with tan cel
crescents, a white rim from 32px up and a dark-slate outline.

| Path                               | Size    | Drawing                | Ground                           |
| ---------------------------------- | ------- | ---------------------- | -------------------------------- |
| public/art/favicon-16.png          | 16x16   | 16, close-up           | disc, transparent outside        |
| public/art/favicon.png             | 32x32   | 32                     | disc, transparent outside        |
| public/favicon.ico                 | 16, 32  | the two favicons above | disc, transparent outside        |
| public/icons/apple-touch-icon.png  | 180x180 | 90, scaled 2x          | full-bleed sunburst square       |
| public/icons/icon-192.png          | 192x192 | 64, scaled 3x          | disc, transparent outside        |
| public/icons/icon-512.png          | 512x512 | 64, scaled 8x          | disc, transparent outside        |
| public/icons/icon-maskable-512.png | 512x512 | 64 at 78%, scaled 8x   | full-bleed sunburst, bird in 80% |

From 32px up she stands whole in the disc, her head 0.18 of the side. At 16px she is a close-up, her head and the
top of her back cut off by the disc inside a 1px edge, so the 3x3 bill and the 2x2 eye still read.

The ground is a sunburst: twelve rays, alternating zone-blue and zone-blue-shade, from a point just above
the icon's centre (behind her), filling the disc and, on the full-bleed icons, the whole square. At16px the
rays do not hold, so the disc is flat zone-blue.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bird  # noqa: E402
import pixel  # noqa: E402
from pixel import K, Grid  # noqa: E402

RAYS = ("zone-blue", "zone-blue-shade")  # the sunburst's alternating rays
RAY_COUNT = 12
FLAT = "zone-blue"  # the 16px ground, where the rays do not hold
OUTPUTS = {
    "public/art/favicon-16.png": (16, "disc", 1),
    "public/art/favicon.png": (32, "disc", 1),
    "public/icons/apple-touch-icon.png": (90, "full", 2),
    "public/icons/icon-192.png": (64, "disc", 3),
    "public/icons/icon-512.png": (64, "disc", 8),
    "public/icons/icon-maskable-512.png": (64, "mask", 8),
}
ICO = "public/favicon.ico"
MASK_SCALE = 0.78  # the subject's scale in the maskable icon, about the centre

# Her size in each drawing: her head's radius as a fraction of the side. From 32px up she stands whole in the
# disc; at 16px only her head and the top of her back show, cut off by the disc, so the bill and eye still read.
WHOLE_R = 0.18
CLOSE = (0.54, 0.44, 0.30)  # the 16px close-up: head centre x, y and radius, as fractions of the side


def bird_px(S, hr, place, feet=True):
    """Her side view with her head radius hr px, drawn from bird.py's shapes: the round head set into the body,
    the 3px nape dip, the softened back, the tail tip, a folded wing, the short bill, the dot eye and (whole)
    the stub feet. place(bounds) returns the head centre for the figure's bounds (left, top, right, bottom,
    relative to the head centre)."""
    s = hr / bird.HEAD_R
    bw, bh = bird.BRX * s, bird.BRY * s
    dx, dy = -bird.HEAD_X * bw, bird.HEAD_UP * bh  # body centre from the head centre
    bounds = (dx - bw - 4 * s, -hr, hr + 5 * s, dy + bh + (2 * s if feet else 0))
    hx, hy = place(bounds)
    bx, by = hx + dx, hy + dy
    g = Grid(S, S)
    ks = max(1, round(3 * s))
    light = bird.LIGHT if S >= 32 else None
    if feet:
        fw, fh = max(2, round(4 * s)), max(1, round(2 * s))
        for fx in (-5, 2):
            g.rect(int(bx + fx * s), int(by + bh), fw, fh, "orange")
    bird.cel(g, bird.in_ell(bx - bw + s, by - s, 4.4 * s, 2.2 * s, -0.45), bird.BASE, bird.SHADE, None,
             max(1, round(s)), 1)
    bird.cel(g, bird.in_body(bx, by, bw, bh, hx - hr * 0.7, bird.NAPE_DROP * s, bird.BACK_FLAT * s), bird.BASE,
             bird.SHADE, light, ks, 1)
    bird.cel(g, bird.in_ell(hx, hy, hr, hr), bird.BASE, bird.SHADE, light, ks, 1)
    bird.flat(g, bird.in_ell(bx - 2 * s, by + 2 * s, bw * 0.5, bh * 0.3, -0.3), bird.WING)
    g.rect(int(hx + hr - 2 * s), int(hy), max(3, round(7 * s)), max(2, round(5 * s)), "orange")  # bill
    e = max(2, round(4 * s))
    g.rect(int(hx), int(hy - hr * 0.55), e, e, "ink")  # dot eye
    return g.outlined(lambda c: K[bird.OUTLINE])


def icon(S, ground):
    """One drawing: ground is "disc" (transparent outside), "full" (sunburst square) or "mask" (sunburst square,
    her shrunk into the central 80%)."""
    f = MASK_SCALE if ground == "mask" else 1.0
    c, R = S / 2, S / 2 * f
    if S <= 16:
        cx, cy, r = CLOSE
        fig = bird_px(S, r * S, lambda b: (cx * S, cy * S), feet=False)
    else:
        def centred(b):  # the figure's bounds centred in the disc
            return c - (b[0] + b[2]) / 2, c - (b[1] + b[3]) / 2
        fig = bird_px(S, WHOLE_R * f * S, centred)
    def ground_at(x, y):
        if S <= 16:
            return K[FLAT]
        a = math.atan2(y + 0.5 - c * 0.95, x + 0.5 - c)
        return K[RAYS[int((a + math.pi) / (2 * math.pi) * RAY_COUNT) % 2]]

    out = Grid(S, S)
    for y in range(S):
        for x in range(S):
            d = ((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2) ** 0.5
            if d <= R - 1:
                out.px[y][x] = fig[y][x] or ground_at(x, y)
            elif d <= R:  # a 1px edge of ground, so the 16px close-up's cut never meets the page
                out.px[y][x] = ground_at(x, y) if S <= 16 else fig[y][x] or ground_at(x, y)
            elif ground != "disc":
                out.px[y][x] = ground_at(x, y)
    return out.px


def image(px, z=1):
    from PIL import Image

    S = len(px)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), pixel.rgb(c) + (255,))
    return im.resize((S * z, S * z), Image.NEAREST) if z != 1 else im


def images():
    return {path: image(icon(S, ground), z) for path, (S, ground, z) in OUTPUTS.items()}


def build():
    ims = images()
    for path, im in ims.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        im.save(path)
    fav16, fav32 = ims["public/art/favicon-16.png"], ims["public/art/favicon.png"]
    fav32.save(ICO, format="ICO", sizes=[(16, 16), (32, 32)], append_images=[fav16])
    print("built", ", ".join(list(ims) + [ICO]))


def preview(out):
    from PIL import Image

    ims = images()
    small = [ims["public/art/favicon-16.png"], ims["public/art/favicon.png"]]
    zoom = [im.resize((im.width * 8, im.height * 8), Image.NEAREST) for im in small]
    gap = 16
    rows = []
    for ground in ("dee1e6", "202124"):
        w = sum(im.width for im in ims.values()) + gap * (len(ims) + 1)
        row = Image.new("RGBA", (w, 512 + 2 * gap), pixel.rgb(ground) + (255,))
        x = gap
        for im in ims.values():
            row.alpha_composite(im, (x, gap))
            x += im.width + gap
        rows.append(row)
    zrow = Image.new("RGBA", (sum(z.width for z in zoom) + gap * 3, 256 + 2 * gap), pixel.rgb("slate") + (255,))
    x = gap
    for z in zoom:
        zrow.alpha_composite(z, (x, gap))
        x += z.width + gap
    rows.append(zrow)
    sheet = Image.new("RGBA", (max(r.width for r in rows), sum(r.height for r in rows)), pixel.rgb("ink") + (255,))
    y = 0
    for r in rows:
        sheet.alpha_composite(r, (0, y))
        y += r.height
    sheet.convert("RGB").save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
