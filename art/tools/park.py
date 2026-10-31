#!/usr/bin/env python3
"""The park theme: an autumn park for chunk-built zones, as a 12px tileset, repeating backdrops and props that the
game places from chunk data.

Usage:
  park.py build             write public/art/tilesets/tiles-park.png + .json and public/art/backdrops/park-*.png,
                            and merge them into the manifest's "tilesets" and "backdrops"
  park.py preview OUT.png   two example chunks joined at a seam (1440x720) with the bird,
                            above the tileset at 4x

Run from the repository root.

Frame and scale: as the street, outdoor scale (a storey about 180px, a door about 45px), 12px tiles, zones 60 rows
(720px) tall. Chunk seams sit at ground rows 50, 40 and 30 (y 600, 480 and 360): a chunk's left and right edges meet
the next chunk's at one of those heights. A step of 1 or 2 rows is a tap's walk-up (a tap rises about 1.5 tiles, a
full hold about 6.5); a taller terrace face is turf over soil, soil-left or soil-right running down the face, any
height. There are no slopes.

Look: a peach autumn sky with cream clouds, tall tan treetops and a skin2 city behind, close to the sky's value;
the ground two bright rows deep (a cream-lipped grass top over green turf) and then warm brown soil with sparse
2px pebble clusters. Every walkable top carries a 2px light lip under a 1px dark edge, the brightest edge against
what is behind it.

tiles-park (12x12; the tileset format and collision rules are in art/README.md, Pipeline)
- grass-top, grass-top-left, grass-top-right: the walkable top, solid; the end tiles round the lip on an exposed
  side (a step's riser).
- turf, turf-left, turf-right: the row under a grass top, solid: green with 2px roots into the soil.
- soil, soil-pebbles, soil-left, soil-right: the fill below, solid; use soil-pebbles on about one tile in five; the
  side tiles show a brown band where the ground is exposed.
- path-top, path-top-joint: a gravel path top, solid; alternate them.
- step-stair, step-stair-left: a stone stair tread inset in a step's grass top, solid, with a white lip so it holds
  2:1 against the tan treetops. Lay steps 2 columns deep and 1 or 2 rows high; make every other one a stair.
- one-way-bench-left, one-way-bench, one-way-bench-right: a bench's seat-back top, 2 rows above the ground.
- one-way-branch-left, one-way-branch, one-way-branch-right: a tree's branch, 6 rows above the ground.
- one-way-bandstand-left, one-way-bandstand, one-way-bandstand-right: the bandstand roof, 6 rows above its base,
  with a white lip so it holds 2:1 against the tan treetops behind it.
- hazard-pond-left, hazard-pond, hazard-pond-right; hazard-pond-bed-left, hazard-pond-bed, hazard-pond-bed-right: a
  shallow pond two rows deep, drawn for a pond hazard placed with a width; not solid. The first row's water
  surface sits 4px below its top with 2px ripples; the second row is darker water over a mud bed. Touching the
  water restarts her: the first row's tiles hit {x 0, y 4, width 12, height 8} (the tileset's "hitboxes") and the
  bed row its whole cell, so 20px from the water surface down. The grass banks beside it stay solid; solid soil
  goes under the bed row.
- hazard-thorn-left, hazard-thorn, hazard-thorn-right: a low thorn hedge one tile tall, drawn for a thorn hazard
  placed with a width; not solid. A dark bramble with pale 2px thorns and dark-red tips, no lip. Each tile hits
  {x 0, y 2, width 12, height 10} (the tileset's "hitboxes").

Backdrops (bottom-left anchored at world y; repeat-x widths divide 720 so chunk seams never show)
- park-sky 48x600 (y 600, x): peach above, a step deeper tan from y 200 behind play.
- park-clouds 360x160 (y 200, x): two flat cream clouds.
- park-treetops 360x420 (y 600, x): tall lobed tan treetops rising into the upper screen.
- park-city 360x200 (y 540, x): the city behind the trees, skin2, with two water towers.
- park-far-trees 240x120 (y 600, x): a band of distant crowns, skin2 over brown.
Sprites (Aseprite, public/art/sprites/<key>.png + .json, listed under the manifest's "sprites")
- park-boat, 72x18, facing right: a rowing boat, the moving platform on a pond. Its collision is 6x1 tiles (72x12)
  with its top on the frame's row 0, the deck line: a 1px dark-brown edge on row 0 and a 2px cream lip on rows 1
  and 2, like every walkable top; nothing is drawn above it. A tan gunwale (rows 3 and 4), then a rust hull lit
  ochre along its top and shaded dark brown underneath, rounded to the keel at row 16 or 17, dipping into the pond's
  water rows. Tag idle, 2 frames at 400ms: frame 1 drops the keel 1px; the deck line stays fixed.
- park-gate, 36x60 (3x5 tiles), the park's room door: no collision, and the game puts a Use zone over it. Anchor:
  the frame's bottom-left on the ground's top, centred in the door's slot. A wrought-iron arch (ink with plum lit
  edges) on two posts with leaf finials and ochre and rust leaves along the arch, over a pale skin1 opening above a
  brown path (the way on); two leaves of 2px bars with scrolls. Tags idle (closed, 1 frame at 400ms) and open (4
  frames at 80ms, played once: the leaves swing back to the posts and hold open) when she uses it.
Props (none; y is the ground top they stand on, given for row 50; add -120 per seam row up)
- park-tree 96x150 (y 600): a lobed rust crown with ochre lit lobes; its one-way-branch row is 6 rows up.
- park-bench 36x24 (y 600): the bench's legs and seat under its one-way-bench row, 2 rows up.
- park-bandstand 120x84 (y 600): posts, rail and base under its one-way-bandstand row, 6 rows up.
- park-lamp 16x84, park-fountain 96x48, park-flower-bed 72x16, park-bin 16x24, park-sign 24x40 (a tree icon, no
  text), all y 600.
- park-reeds 24x30 (y 610) and park-lily-pad 14x4 (y 608): at a pond's edges and on its surface.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
from pixel import rgb  # noqa: E402

T = 12
COLUMNS = 8
TILESET = "tiles-park"
TILESETS = "public/art/tilesets"
BACKDROPS = "public/art/backdrops"
SPRITES = "public/art/sprites"

GRASS = ("dgreen", "cream", "green")          # edge, lip, body
SOIL = ("brown", "dbrown", "plum")             # fill, pebbles and roots, side edge
PATH = ("dbrown", "cream", "tan", "brown")    # edge, lip, body, gravel
STONE = ("dbrown", "white", "skin2", "brown")  # edge, lip, body, joint
WATER = ("blue", "sky", "navy")                # water, ripple, deep
BENCH = ("plum", "cream", "dbrown")
ROOF = ("plum", "white", "forest", "dgreen")     # a white lip: the roof stands against the tan treetops
HEDGE = ("ink", "forest", "cream")
LEAF = ("rust", "ochre", "dbrown")


def image(w, h):
    from PIL import Image

    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def fill(im, x, y, w, h, c):
    """A rectangle in colour c, or cleared to transparent when c is None."""
    from PIL import ImageDraw

    if c is None:
        im.paste((0, 0, 0, 0), (x, y, x + w, y + h))
    else:
        ImageDraw.Draw(im).rectangle((x, y, x + w - 1, y + h - 1), fill=rgb(c) + (255,))
    return im


def R(im, *rects):
    for x, y, w, h, c in rects:
        fill(im, x, y, w, h, c)
    return im


# ---------------------------------------------------------------- tiles

def grass(kind=""):
    edge, lip, body = GRASS
    t = R(image(T, T), (0, 0, T, T, SOIL[0]), (0, 0, T, 1, edge), (0, 1, T, 2, lip), (0, 3, T, 3, body),
          (2, 6, 3, 1, body), (8, 6, 2, 1, body))
    if "l" in kind:                                           # a soft rounded lip on an exposed end
        R(t, (0, 0, 2, 1, None), (0, 1, 1, 1, None), (1, 1, 1, 2, edge), (0, 3, 1, 9, edge))
    if "r" in kind:
        R(t, (T - 2, 0, 2, 1, None), (T - 1, 1, 1, 1, None), (T - 2, 1, 1, 2, edge), (T - 1, 3, 1, 9, edge))
    return t


def soil(kind="", pebbles=False):
    fillc, pebble, side = SOIL
    t = R(image(T, T), (0, 0, T, T, fillc))
    if pebbles:
        R(t, (2, 8, 2, 2, pebble), (8, 2, 2, 1, pebble))
    if "l" in kind:
        R(t, (0, 0, 3, T, pebble), (0, 0, 1, T, side))
    if "r" in kind:
        R(t, (T - 3, 0, 3, T, pebble), (T - 1, 0, 1, T, side))
    return t


def turf(kind=""):
    t = R(soil(kind), (0, 0, T, 6, "green"), (0, 6, T, 1, "dgreen"), (2, 7, 2, 2, "dgreen"), (8, 7, 2, 3, "dgreen"))
    if "l" in kind:
        R(t, (0, 0, 3, T, SOIL[1]), (0, 0, 1, T, SOIL[2]))
    if "r" in kind:
        R(t, (T - 3, 0, 3, T, SOIL[1]), (T - 1, 0, 1, T, SOIL[2]))
    return t


def path(joint=False):
    edge, lip, body, under = PATH
    t = R(image(T, T), (0, 0, T, T, SOIL[0]), (0, 0, T, 1, edge), (0, 1, T, 2, lip), (0, 3, T, 4, body),
          (0, 7, T, 1, under), (3, 4, 2, 1, under), (8, 5, 2, 1, under))
    if joint:
        R(t, (T - 1, 3, 1, 4, under))
    return t


def stair(kind=""):
    edge, lip, body, joint = STONE
    t = grass(kind)
    x0 = 2 if "l" in kind else 0
    return R(t, (x0, 0, T - x0, 1, edge), (x0, 1, T - x0, 2, lip), (x0, 3, T - x0, 3, body),
             (x0, 6, T - x0, 1, joint))


def bench(kind):
    edge, lip, wood = BENCH
    t = R(image(T, T), (0, 0, T, 1, edge), (0, 1, T, 2, lip), (0, 3, T, 3, wood), (0, 6, T, 1, edge))
    if kind in "lr":
        R(t, (2 if kind == "l" else T - 4, 7, 2, 5, edge))
    return t


def branch(kind):
    leaf, lit, shade = LEAF
    t = R(image(T, T), (0, 2, T, 3, "brown"), (0, 2, T, 1, "tan"), (0, 5, T, 1, "dbrown"), (0, 0, T, 1, "dbrown"),
          (0, 1, T, 1, "cream"))
    if kind == "r":
        R(t, (T - 4, 0, 4, 6, None), (T - 6, 6, 6, 4, leaf), (T - 5, 6, 3, 1, lit))
    if kind == "l":
        R(t, (0, 0, 2, 6, None))
    return t


def roof(kind):
    edge, lip, a, b = ROOF
    t = R(image(T, T), (0, 0, T, 1, edge), (0, 1, T, 2, lip), (0, 3, T, 5, a), (0, 3, 4, 5, b), (8, 3, 4, 5, b))
    for x in (0, 6):
        R(t, (x + 1, 8, 4, 1, a), (x + 2, 9, 2, 1, edge))
    if kind == "l":
        R(t, (0, 0, 1, 9, edge))
    if kind == "r":
        R(t, (T - 1, 0, 1, 9, edge))
    return t


def pond(kind, bed):
    w, hi, deep = WATER
    t = image(T, T)
    if not bed:
        R(t, (0, 4, T, 8, w), (0, 4, T, 1, hi), (2, 7, 4, 1, "white"), (8, 9, 3, 1, hi))
        if kind == "l":
            R(t, (0, 0, 3, T, SOIL[1]), (3, 6, 2, 6, SOIL[1]))
        if kind == "r":
            R(t, (T - 3, 0, 3, T, SOIL[1]), (T - 5, 6, 2, 6, SOIL[1]))
    else:
        R(t, (0, 0, T, 8, deep), (0, 8, T, 4, SOIL[1]))
        if kind == "l":
            R(t, (0, 0, 5, T, SOIL[1]))
        if kind == "r":
            R(t, (T - 5, 0, 5, T, SOIL[1]))
    return t


def thorn(kind):
    dark, mid, th = HEDGE
    t = R(image(T, T), (0, 5, T, 7, dark), (1, 7, 4, 3, mid), (7, 8, 4, 3, mid))
    for x in (1, 5, 9):
        R(t, (x, 2, 2, 3, th), (x, 1, 1, 1, th), (x, 0, 1, 1, "dred"))
    if kind == "l":
        R(t, (0, 5, 1, 2, None), (0, 3, 2, 2, th))
    if kind == "r":
        R(t, (T - 1, 5, 1, 2, None), (T - 2, 3, 2, 2, th))
    return t


# Hit boxes for the hazard tiles that hit less than their whole 12x12 cell, in pixels within the tile, written to
# tiles-park.json's "hitboxes": each thorn tile from 2px below its top, and the pond's first row from its water
# surface down. The pond's bed row hits its whole cell, so it has no entry.
HITBOXES = {
    **{f"hazard-thorn{s}": {"x": 0, "y": 2, "width": 12, "height": 10} for s in ("-left", "", "-right")},
    **{f"hazard-pond{s}": {"x": 0, "y": 4, "width": 12, "height": 8} for s in ("-left", "", "-right")},
}


def three(name, fn):
    return [(f"{name}-left", fn("l")), (name, fn("m")), (f"{name}-right", fn("r"))]


def tiles():
    return ([("grass-top", grass()), ("grass-top-left", grass("l")), ("grass-top-right", grass("r")),
             ("turf", turf()), ("turf-left", turf("l")), ("turf-right", turf("r")),
             ("soil", soil()), ("soil-pebbles", soil(pebbles=True)), ("soil-left", soil("l")),
             ("soil-right", soil("r")), ("path-top", path()), ("path-top-joint", path(True)),
             ("step-stair", stair()), ("step-stair-left", stair("l"))]
            + three("one-way-bench", bench) + three("one-way-branch", branch) + three("one-way-bandstand", roof)
            + three("hazard-pond", lambda k: pond(k, False)) + three("hazard-pond-bed", lambda k: pond(k, True))
            + three("hazard-thorn", thorn))


# ---------------------------------------------------------------- backdrops

LOBES = ((0, 0, 1.0), (-0.62, 0.22, 0.62), (0.62, 0.22, 0.62), (-0.32, -0.5, 0.56), (0.36, -0.46, 0.5),
         (0, 0.42, 0.7), (-0.8, 0.5, 0.4), (0.82, 0.48, 0.4))


def crown(im, cx, cy, rx, ry, base, lit, shade, lit_lobes=(1, 3)):
    """A tree crown as a lobed mass, cel-shaded: the shade, the base a little up and left, then lit lobes on the
    top-left only, so its edge is broken and no colour sits as a round blob inside another."""
    from PIL import ImageDraw

    d = ImageDraw.Draw(im)

    def lobes(dx, dy, k, c, only=None):
        for i, (ox, oy, r) in enumerate(LOBES):
            if only is None or i in only:
                x, y, ex, ey = cx + ox * rx + dx, cy + oy * ry + dy, r * rx * k, r * ry * k
                d.ellipse((x - ex, y - ey, x + ex, y + ey), fill=rgb(c))
    lobes(0, 0, 0.62, shade)
    lobes(-2, -3, 0.56, base)
    if lit_lobes:
        lobes(-4, -6, 0.34, lit, only=lit_lobes)
    return im


def sky():
    return R(image(48, 600), (0, 0, 48, 600, "skin1"), (0, 200, 48, 400, "tan"))


def clouds():
    from PIL import ImageDraw

    im = image(360, 160)
    d = ImageDraw.Draw(im)
    for x, y, parts in ((20, 40, ((0, 10, 56, 26), (12, 2, 38, 26), (30, 6, 60, 26))),
                        (200, 100, ((0, 8, 70, 26), (16, 0, 48, 26), (42, 4, 74, 26)))):
        for a, b, c, e in parts:
            d.ellipse((x + a, y + b, x + c, y + e), fill=rgb("cream"))
        fill(im, x, y + 20, 74, 6, "cream")
    return im


def treetops():
    im = image(360, 420)
    for cx, top, r in ((40, 130, 54), (130, 70, 64), (230, 160, 54), (320, 100, 60)):
        fill(im, cx - 4, top + r, 8, 420 - top - r, "brown")
        crown(im, cx, top + r, r * 1.1, r, "skin2", "tan", "brown")
    return im


def city():
    im = image(360, 200)
    for x, w, top in ((0, 40, 100), (40, 60, 60), (100, 36, 120), (136, 44, 0), (180, 60, 80), (240, 50, 40),
                      (290, 40, 110), (330, 30, 70)):
        fill(im, x, top, w, 200 - top, "skin2")
    for tx, top in ((10, 100), (190, 80)):                      # water towers
        R(im, (tx, top - 20, 14, 14, "skin2"), (tx + 2, top - 6, 2, 6, "skin2"), (tx + 10, top - 6, 2, 6, "skin2"))
    return im


def far_trees():
    im = R(image(240, 120), (0, 84, 240, 36, "brown"))
    for cx, r in ((0, 40), (60, 46), (120, 40), (180, 48), (240, 40)):
        crown(im, cx, 74, r, r * 0.8, "skin2", None, "brown", lit_lobes=())
    return im


def tree():
    im = R(image(96, 150), (42, 50, 10, 100, "dbrown"), (42, 50, 3, 100, "brown"))
    return crown(im, 48, 38, 46, 36, "rust", "ochre", "dbrown")


def bench_legs():
    edge, lip, wood = BENCH
    return R(image(36, 24), (0, 12, 36, 4, wood), (0, 12, 36, 1, lip), (2, 16, 2, 8, edge), (32, 16, 2, 8, edge))


def bandstand():
    edge, lip, a, b = ROOF
    im = R(image(120, 84), (0, 72, 120, 12, STONE[2]), (0, 72, 120, 2, "cream"), (4, 54, 112, 3, edge))
    for x in (6, 40, 76, 110):
        fill(im, x, 6, 4, 66, edge)
    for x in range(10, 110, 8):
        fill(im, x, 57, 2, 15, edge)
    return im


def lamp():
    return R(image(16, 84), (7, 10, 2, 74, "ink"), (2, 0, 12, 10, "ink"), (4, 2, 8, 6, "dslate"),
             (4, 80, 8, 4, "ink"))


def fountain():
    w, hi, deep = WATER
    im = R(image(96, 48), (0, 30, 96, 18, STONE[2]), (0, 30, 96, 3, "cream"), (4, 34, 88, 6, w),
           (42, 10, 12, 22, STONE[2]), (36, 8, 24, 4, "cream"))
    for x, h in ((44, 8), (48, 12), (52, 8)):
        fill(im, x, 8 - h // 2, 2, h // 2, hi)
    return im


def flower_bed():
    im = R(image(72, 16), (0, 8, 72, 8, SOIL[0]), (0, 6, 72, 4, "green"))
    for i, x in enumerate(range(2, 70, 6)):
        fill(im, x, 2 + (i % 2) * 2, 4, 4, ("mauve", "purple", "pink")[i % 3])
    return im


def bin_():
    im = R(image(16, 24), (2, 4, 12, 20, "forest"), (2, 4, 12, 2, "dgreen"), (0, 2, 16, 3, "ink"))
    for x in (5, 9):
        fill(im, x, 8, 2, 14, "teal")
    return im


def sign():
    im = R(image(24, 40), (11, 16, 2, 24, "dbrown"), (0, 0, 24, 16, "forest"), (1, 1, 22, 14, "dgreen"))
    for x, y, w in ((11, 3, 2), (9, 5, 6), (7, 7, 10), (11, 9, 2), (11, 11, 2)):   # a tree icon
        fill(im, x, y, w, 2, "cream")
    return im


def reeds():
    im = image(24, 30)
    for x, top in ((2, 6), (6, 0), (10, 8), (15, 2), (19, 10)):
        fill(im, x, top, 2, 30 - top, "dgreen")
    for x, top in ((6, 2), (15, 4)):
        fill(im, x, top, 2, 6, "dbrown")
    return im


def lily_pad():
    return R(image(14, 4), (1, 0, 12, 4, "dgreen"), (0, 1, 14, 2, "dgreen"), (6, 0, 2, 2, WATER[0]),
             (2, 1, 4, 1, "green"))


# key: (draw, bottom y, repeat)
BACKDROP_DEFS = {
    "park-sky": (sky, 600, "x"),
    "park-clouds": (clouds, 200, "x"),
    "park-treetops": (treetops, 600, "x"),
    "park-city": (city, 540, "x"),
    "park-far-trees": (far_trees, 600, "x"),
    "park-tree": (tree, 600, "none"),
    "park-bench": (bench_legs, 600, "none"),
    "park-bandstand": (bandstand, 600, "none"),
    "park-lamp": (lamp, 600, "none"),
    "park-fountain": (fountain, 600, "none"),
    "park-flower-bed": (flower_bed, 600, "none"),
    "park-bin": (bin_, 600, "none"),
    "park-sign": (sign, 600, "none"),
    "park-reeds": (reeds, 610, "none"),
    "park-lily-pad": (lily_pad, 608, "none"),
}


# ---------------------------------------------------------------- sprites

def boat(frame=0):
    """park-boat, 72x18: the deck line on row 0, the hull below; frame 1 drops the keel 1px."""
    g = pixel.Grid(72, 18)
    g.rect(1, 0, 70, 1, "dbrown")
    g.rect(1, 1, 70, 2, "cream")
    g.rect(1, 3, 70, 2, "tan")
    g.rect(0, 1, 1, 5, "dbrown")
    g.rect(71, 1, 1, 5, "dbrown")
    g.rect(1, 5, 70, 1, "dbrown")
    keel = 16 + frame
    for y in range(6, keel):
        inset = 1 + ((y - 5) ** 2) // (6 if frame else 5)       # the hull rounds in towards the keel
        x0, x1 = inset, 71 - inset
        if x1 <= x0:
            break
        g.rect(x0, y, x1 - x0 + 1, 1, "rust")
        g.p(x0 - 1, y, "dbrown")
        g.p(x1 + 1, y, "dbrown")
        if y == 6:
            g.rect(x0, y, x1 - x0 + 1, 1, "ochre")              # lit along the top
        if y >= keel - 3:
            g.rect(x0 + (x1 - x0) // 3, y, (x1 - x0) * 2 // 3 + 1, 1, "dbrown")   # shade underneath, lower right
        last = (x0, x1, y)
    x0, x1, y = last
    g.rect(x0, y + 1, x1 - x0 + 1, 1, "dbrown")
    for x in (20, 50):                                         # the oarlocks' rowlocks, 2px, on the gunwale
        g.rect(x, 3, 2, 2, "dbrown")
    return g.px


def gate(open_k=0):
    """park-gate, 36x60: an iron arch over a pale opening, its two leaves swung open_k quarters back to the posts."""
    g = pixel.Grid(36, 60)
    g.rect(5, 12, 26, 48, "skin1")                              # the way on, pale
    g.rect(5, 50, 26, 10, "brown")
    g.ell(18, 16, 13, 12, "ink")                                # the arch: a 2px iron band
    g.ell(18, 16, 11, 10, "skin1")
    g.rect(5, 16, 26, 44, "skin1")
    g.rect(5, 50, 26, 10, "brown")
    for x in (0, 31):                                           # posts with a plum lit edge
        g.rect(x, 12, 5, 48, "ink")
        g.rect(x + 1, 12, 1, 48, "plum")
        g.rect(x - 0, 8, 5, 4, "ink")                           # finial base
        g.rect(x + 1, 4, 3, 4, "forest")                        # a leaf finial
        g.rect(x + 2, 2, 1, 2, "forest")
    for x, y, c in ((8, 8, "ochre"), (13, 5, "rust"), (21, 5, "ochre"), (26, 8, "rust"), (17, 3, "ochre")):
        g.rect(x, y, 3, 2, c)                                   # leaves along the arch
        g.p(x + 1, y + 2, c)
    half = 13 * (4 - open_k) // 4                               # each leaf's visible width
    for side in (0, 1):
        x0 = 5 if side == 0 else 31 - half
        if half <= 1:
            g.rect(5 if side == 0 else 29, 18, 2, 40, "ink")     # fully open: edge-on against the post
            continue
        g.rect(x0, 20, half, 2, "ink")
        g.rect(x0, 48, half, 2, "ink")
        for bx in range(x0, x0 + half, 4):
            g.rect(bx, 18, 2, 40, "ink")
        cx = x0 + half // 2
        g.rect(cx - 2, 32, 4, 2, "ink")                         # a scroll with a leaf
        g.rect(cx - 1, 30, 2, 2, "forest")
    return g.px


# Tags that play once and hold their last frame; every other tag loops.
ONCE = {"park-gate": ("open",)}


def sprites():
    yield "park-boat", [("idle", [boat(0), boat(1)], 400)]
    yield "park-gate", [("idle", [gate(0)], 400), ("open", [gate(k) for k in (1, 2, 3, 4)], 80)]


# ---------------------------------------------------------------- build

def tileset_image(items):
    from PIL import Image

    rows = -(-len(items) // COLUMNS)
    im = Image.new("RGBA", (COLUMNS * T, rows * T), (0, 0, 0, 0))
    for i, (_, t) in enumerate(items):
        im.alpha_composite(t, ((i % COLUMNS) * T, (i // COLUMNS) * T))
    return im


def build():
    os.makedirs(TILESETS, exist_ok=True)
    os.makedirs(BACKDROPS, exist_ok=True)
    tileset = pixel.write_tileset(TILESET, tiles(), hitboxes=HITBOXES, size=T, columns=COLUMNS)
    backdrops = []
    for key, (fn, y, repeat) in BACKDROP_DEFS.items():
        im = fn()
        im.save(f"{BACKDROPS}/{key}.png")
        backdrops.append({"key": key, "png": f"backdrops/{key}.png", "width": im.width, "height": im.height,
                          "anchor": "bottom-left", "y": y, "repeat": repeat})
    pixel.update_manifest("tilesets", [tileset])
    pixel.update_manifest("backdrops", backdrops)
    pixel.build(list(sprites()), "art/park", once=ONCE)
    print("built", TILESET, "and", len(backdrops), "backdrops")


# ---------------------------------------------------------------- preview: two example chunks

# Chunk 1 (cols 0-59): grass at row 50 with a path, a bench, a tree with its branch, then five 2-row steps up to row 40
# at the seam. Chunk 2 (cols 60-119): row 40 with a fountain, a pond, five 2-row steps up to a terrace at row 30 with
# the bandstand, a drop back to row 40 and a thorn hedge before the right edge.
STEPS = [(30 + 2 * i, 48 - 2 * i) for i in range(5)] + [(94 + 2 * i, 38 - 2 * i) for i in range(5)]
POND = (76, 85)
LEDGES = [("bench", 48, 10, 3), ("branch", 44, 16, 6), ("bandstand", 24, 104, 8)]
THORNS = (112, 3, 39)
BOAT = (78, 40)       # col, the pond row its deck sits on
GATE = (116, 40)      # col, the ground row it stands on


def tops():
    m = {}
    for c in range(0, 30):
        m[c] = (50, "path" if 8 <= c <= 21 else "grass")
    for i, (c, r) in enumerate(STEPS):
        for cc in (c, c + 1):
            m[cc] = (r, "stair" if i % 2 else "grass")
    for c in list(range(40, 76)) + list(range(86, 94)) + list(range(112, 120)):
        m[c] = (40, "grass")
    for c in range(104, 112):
        m[c] = (30, "grass")
    return m


def example(chars=True):
    from PIL import Image

    t = dict(tiles())
    im = Image.new("RGBA", (1440, 720), rgb("ink") + (255,))
    art = {k: fn() for k, (fn, _, _) in BACKDROP_DEFS.items()}

    def put(key, x, ground_row=50, extra=0):
        p = art[key]
        y = BACKDROP_DEFS[key][1] - 600 + ground_row * T + extra
        im.alpha_composite(p, (x, y - p.height))

    for key in ("park-sky", "park-clouds", "park-treetops", "park-city", "park-far-trees"):
        for x in range(0, 1440, art[key].width):
            put(key, x)
    put("park-tree", 16 * T - 6)
    put("park-lamp", 4 * T)
    put("park-lamp", 88 * T, 40)
    put("park-flower-bed", 23 * T)
    put("park-bench", 10 * T)
    put("park-bin", 44 * T, 40)
    put("park-sign", 56 * T, 40)
    put("park-fountain", 63 * T, 40)
    put("park-bandstand", 104 * T - 12, 30)
    put("park-reeds", POND[0] * T - 14, 40)
    put("park-reeds", (POND[1] + 1) * T - 6, 40)
    m = tops()
    for c, (top, kind) in m.items():
        k = ("l" if c - 1 not in m or m[c - 1][0] > top else "") + ("r" if c + 1 not in m or m[c + 1][0] > top else "")
        name = {"path": "path-top-joint" if c % 2 else "path-top",
                "stair": "step-stair-left" if "l" in k else "step-stair"}.get(kind)
        im.alpha_composite(t[name] if name else grass(k), (c * T, top * T))
        for r in range(top + 1, 60):
            lk = ("l" if c - 1 not in m or m[c - 1][0] > r else "") + ("r" if c + 1 not in m or m[c + 1][0] > r else "")
            tile = turf(lk) if r == top + 1 else soil(lk, pebbles=(c * 7 + r * 3) % 5 == 0)
            im.alpha_composite(tile, (c * T, r * T))
    for c in range(POND[0], POND[1] + 1):
        side = "-left" if c == POND[0] else "-right" if c == POND[1] else ""
        im.alpha_composite(t[f"hazard-pond{side}"], (c * T, 40 * T))
        im.alpha_composite(t[f"hazard-pond-bed{side}"], (c * T, 41 * T))
        for r in range(42, 60):
            im.alpha_composite(soil(pebbles=(c * 7 + r * 3) % 5 == 0), (c * T, r * T))
    put("park-lily-pad", 78 * T + 3, 40)
    put("park-lily-pad", 82 * T + 6, 40)
    for name, row, c0, w in LEDGES:
        for c in range(c0, c0 + w):
            side = "-left" if c == c0 else "-right" if c == c0 + w - 1 else ""
            im.alpha_composite(t[f"one-way-{name}{side}"], (c * T, row * T))
    c0, w, row = THORNS
    for c in range(c0, c0 + w):
        side = "-left" if c == c0 else "-right" if c == c0 + w - 1 else ""
        im.alpha_composite(t[f"hazard-thorn{side}"], (c * T, row * T))
    bx, brow = BOAT
    im.alpha_composite(pixel_image(boat(0)), (bx * T, brow * T))
    gx, grow = GATE
    im.alpha_composite(pixel_image(gate(0)), (gx * T, grow * T - 60))
    if chars:
        bird = Image.open(f"{SPRITES}/bird.png").convert("RGBA").crop((0, 0, 48, 42))
        im.alpha_composite(bird, (14 * T - 24, 50 * T - 42))
    return im.convert("RGB")


def pixel_image(px):
    from PIL import Image

    im = Image.new("RGBA", (len(px[0]), len(px)), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), rgb(c) + (255,))
    return im


def walkable_check(im):
    """The worst lip against what is directly behind each walkable top (WCAG), and where it is."""
    worst = (99.0, None)
    spots = [(c * T + 6, top) for c, (top, _) in tops().items()]
    spots += [(c * T + 6, row) for _, row, c0, w in LEDGES for c in range(c0, c0 + w)]
    for x, row in spots:
        lip = "%02x%02x%02x" % im.getpixel((x, row * T + 1))[:3]
        behind = "%02x%02x%02x" % im.getpixel((x, row * T - 1))[:3]
        r = pixel.contrast(lip, behind)
        if r < worst[0]:
            worst = (r, (x // T, row))
    return worst


def preview(out):
    from PIL import Image

    ex = example()
    print("worst walkable lip against its backdrop: %.2f:1 at col, row %s" % walkable_check(example(chars=False)))
    ts = tileset_image(tiles())
    bg = Image.new("RGBA", ts.size, rgb("dslate") + (255,))
    bg.alpha_composite(ts)
    ts = bg.convert("RGB").resize((ts.width * 4, ts.height * 4), Image.NEAREST)
    sheet = Image.new("RGB", (ex.width, ex.height + 16 + ts.height), rgb("ink"))
    sheet.paste(ex, (0, 0))
    sheet.paste(ts, (0, ex.height + 16))
    sheet.save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
