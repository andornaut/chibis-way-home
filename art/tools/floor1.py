"""Zone 1 art: a New York street (downtown on a pale steel morning, two screens tall, climbed into its upper
screen), and the boutique lobby kept for a later indoor zone, as 12px tilesets and modular backdrop pieces that the
game places from level data. Nothing here is a fixed panorama.

Usage:
  floor1.py build             write public/art/tilesets/<key>.png + .json and public/art/backdrops/<key>.png, and
                              list them in the manifest under "tilesets" and "backdrops"
  floor1.py preview OUT.png   an example street column and an example lobby, each 720x720 (two screens tall),
                              beside both tilesets at 4x, composed from the pieces with the bird and
                              the touch buttons

Run from the repository root.

Scale
- Outdoors the world is drawn as if zoomed out 4x while the bird and the 12px tiles keep their size: a storey is
  180px and a door is about 45px, so the bird (42px) stands almost as tall as a street door. The street is 720px
  (60 tiles) tall: the sidewalk's top is y 600 (row 50) with 10 rows of sidewalk and road below it, the ground
  storey runs from y 420 to it, and storeys stack every 180px above (a three-storey walk-up's roof is at y 60,
  row 5). Indoors (the lobby) is a separate scene at full scale, also 720px tall, its floor at y 672.

Palette (the street; the lobby keeps its own)
- A pale steel atmosphere: flat zone-blue sky, zone-blue-shade window-free distant skyline and sparse slate
middle-distance
  buildings. The two city layers repeat at 720px and stay separate for parallax. Near facades and shopfronts use
  slate, dslate and grey, with quiet windows. Cream icons, ochre awnings and amber room doors provide warm accents.
- street-city-far: 720x600, bottom y 600, repeat x; suggested horizontal scroll factor 0.15.
- street-city-mid: 720x600, bottom y 600, repeat x; suggested horizontal scroll factor 0.4.
- street-sky stays fixed; near facades, storefronts, doors, ledges and attached props share gameplay motion.
- street-skyline remains a 336x600 combined fallback. Use it or the separate city layers, never both.

Tilesets
- A tileset is one PNG of 12x12 tiles in rows of COLUMNS (8), no spacing or margin, transparent where a tile has no
  art, and a JSON beside it:
    {"tileSize": 12, "columns": 8,
     "tiles": {"<name>": <index>, ...},                  index = row * columns + column, every tile named
     "pieces": {"<name>": [[<index>, ...], ...]}}        multi-tile pieces as rows of indices, top row first
  Names are kebab-case. A tile whose name starts with "one-way-" is a one-way ledge: it stops a fall onto its top
  edge and nothing else. A tile whose name starts with "door-" or "exit-" is a doorway: it has no collision, and
  where the level gives it a room, the game puts a Use zone over its piece. A tile whose name starts with "pit-"
  is a pit: it has no collision, so she falls through it and out of the level. Every other tile with art is solid
  on all sides.
- The manifest lists each as {"key": "<key>", "png": "tilesets/<key>.png", "json": "tilesets/<key>.json"}.
- Walkable surfaces: the walkable edge is the tile's top row. A surface tile has a 1px edge, a 2px light lip and
  a 2px darker underside; the face tiles below it are plainer and darker.

tiles-street
- sidewalk-top, sidewalk-top-joint (a 2px slab joint at the right edge; alternate them, 24px rhythm),
  sidewalk-top-left, sidewalk-top-right (plain ends, over a drop), kerb-left, kerb-right (a pale stone kerb where
  the sidewalk meets a cross street, one tile above the road), sidewalk-face, sidewalk-face-left,
  sidewalk-face-right: pale concrete (white lip, lgrey slabs) over a slate face.
- road-top, road: asphalt, one tile below the sidewalk.
- one-way-awning-left, one-way-awning, one-way-awning-right: an ochre-and-cream shop awning seen front-on, 4px
  stripes and a scalloped hem, art in the top 11 rows. Lay them on row 20 (y 240), 6 tiles above the sidewalk,
  across a shopfront under its sign.
- one-way-canopy-left, one-way-canopy, one-way-canopy-right: a dark-brown canopy with a white lip, the same shape,
  laid on row 20 over the hotel door.
- planter-top-left, planter-top, planter-top-right (a clipped hedge: the walkable top), planter-left, planter,
  planter-right (the box). A planter is 2 tiles tall: a 2-tile step.
- door (piece, 3x4 tiles, 36x48): a pair of lit amber glass doors in a slate frame, a room's door
  where the level has one. Tiles door-0 to door-11 in row order; no collision.
- The cellar hatch, a hazard: an open pit in the sidewalk, any number of tiles wide, its two steel leaves standing
  up. On the sidewalk row: hatch-left, then pit-opening for each opening tile, then hatch-right. pit-opening fills
  every row below the opening to the level's bottom, and sidewalk-face-right and sidewalk-face-left run down under
  the two edges. pit-leaf-left-top over pit-leaf-left stand on the two rows above hatch-left, pit-leaf-right-top
  over pit-leaf-right above hatch-right. hatch-left and hatch-right are solid sidewalk ends capped by a steel angle
  iron; pit-opening is the dark drop (ink); the leaves are slate plates with dslate studs, 20px tall, leaning
  outwards, with no collision. Steel is the slate ramp (slate, dslate, navy), no grey. Tiles 35 to 41, after the
  door, so every earlier index holds.
- Climbing, tiles 42 to 53, after the hatch, so every earlier index holds. One-way ledges, each with left, middle
  and right tiles, laid any width at the reaches (a hop rises 3 tiles, a full jump 8); every top has a 2px white
  lip under a 1px dark edge, so it reads against any facade in greyscale:
  one-way-fire-escape-* (a black iron landing, art in the top 7 rows; stand fire-escape-railing on it and run
  fire-escape-ladder up to the next landing, a few tiles and at most 8 above), one-way-sill-* (a stone window sill,
  2 or 3 wide, art in the top 7 rows, its top on a window's sill line), one-way-cornice-* (a rooftop cornice with
  dentils, the full tile, along a roofline's top edge), one-way-tank-* (a water tower's flat top, 4 wide on the
  water-tower piece's second tile row, 6 tiles above its roof).

tiles-lobby (the boutique lobby: wood, books and plants, at indoor scale; kept for a later indoor zone)
- Every walkable top, the floor and each one-way ledge, has the same 2px cream lip under a 1px plum edge, so the
  standable edges are the brightest lines in the room, in colour and in greyscale.
- floor-top, floor-top-joint (a 2px board end at the right edge; alternate them, 24px rhythm), floor-top-left,
  floor-top-right, floor-face, floor-face-left, floor-face-right: brown boards over a dark-brown face. The lobby
  floor line is y 672 (row 56) in a level 720px (60 tiles) tall.
- One-way ledges, each a 7px slab (left, middle, right): one-way-balcony-* (the mezzanine's front edge),
  one-way-shelf-* (bookcase boards, with brackets on the end tiles), one-way-cushion-* (the sofa's seat and back),
  one-way-desk-* (the reception desk's top).
- post-cap-left/right, post-left/right, post-base-left/right: a wood post 2 tiles wide, solid, for the room's
  ends.
- exit (piece, 7x15 tiles, 84x180, a door at indoor scale): a stairwell, an opening with stairs rising to the
  right under a white up-arrow on a green sign. Tiles exit-0 to exit-104 in row order; no collision.

Backdrops
- One PNG per piece in public/art/backdrops/<key>.png, drawn behind the play layer, lower in contrast and
  saturation than the tiles. The manifest lists each as
    {"key": "<key>", "png": "backdrops/<key>.png", "width": w, "height": h, "anchor": "bottom-left", "y": y,
     "repeat": "x" | "none"}
  The piece's bottom-left corner sits at world y (its bottom edge), at an x the level data chooses. "repeat": "x"
  tiles it horizontally across a run; "none" places it once. Street y values are in the two-screen frame (the
  sidewalk's top at y 600, row 50); the sidewalk and road tiles fill rows 50 to 59 below it. Draw order, back to
  front: sky, skyline, facades and
  their upper storeys and rooflines, facade pieces, storefronts, street furniture, then the play layer.
- Sky and city (repeat x): street-sky 48x600 (y 600), flat zone-blue. street-city-far and street-city-mid are each
  720x600 (y 600), window-free zone-blue-shade and slate silhouettes. street-skyline 336x600 is their combined
  fallback.
- Facades (repeat x, one per building type; a run per building): facade-one-storey 48x192 (y 600, a parapet 192
  up), facade-walkup 48x312, facade-brownstone 48x312, facade-hotel 48x312 (y 600 each). Each shows the 180px
  ground storey with a band over the shopfronts and the next storey's windows above, up to y 288.
- Upper storeys and rooflines (repeat x): facade-walkup-upper, facade-brownstone-upper, facade-hotel-upper, each
  48x180, stack above the facade piece every 180px (bottoms at y 288, then 108) with no seam;
  roofline-walkup, roofline-brownstone, roofline-hotel, each 48x48, cap the topmost piece (bottom at its top), so
  the roof is 48px above it (y 240, row 20, on a facade piece; y 60, row 5, on one upper storey, the tallest that
  fits). Lay one-way-cornice along it. A water tower (its tank top 6 tiles above its roof) fits on a two-storey roof
  (tank top row 14), not on a three-storey one.
- Facade pieces (none): fire-escape 196x185 (y 473, on a walk-up), hotel-crest 98x44 (y 478, over the door: two
  banners and the crest), hotel-window 32x152 (y 592, a tall window). The tall dark stone building and these
  pieces are generic until the exit is decided.
- Climbing (backdrop, no collision): fire-escape-railing 48x24 (repeat x, its bottom on a landing's top),
  fire-escape-ladder 24x96 (none, 2x8 tiles) and fire-escape-ladder-4, -5, -6, -7 (24x48 to 24x84, 2x4 to
  2x7 tiles): one per landing spacing in rows; place the one matching the spacing with its bottom on the lower
  landing's top (y = lower row * 12), so its top meets the upper landing; water-tower 48x84 (none,
  4x7 tiles, its bottom on a roof; one-way-tank tiles on its second tile row).
- Storefronts (none), each 120 tall (y 600), a whole number of tiles wide, with a sign icon (never text), a tall
  display window and a 46px door: storefront-cafe 84, storefront-florist 84, storefront-gift-shop 96,
  storefront-makeup-store 96, storefront-pet-shop 108, storefront-diner 108, storefront-noodle-bar 120.
- Street furniture (none, y 600): cab 96x40, hot-dog-cart 40x70, subway-railing 72x62, street-tree 64x136,
  walk-signal 12x82, doorman-podium 18x24, canopy-poles 60x60 (under the canopy's end tiles), cross-street
  120x26 (the far avenue between two kerbs; place no facade over a cross street so the skyline shows).
- Lobby (kept for a later indoor zone; indoor scale, the floor line is y 672): lobby-wall 48x720 (y 720, x: wood
panelling, cornice,
  wainscot), lobby-balustrade 48x36 (y at the balcony's floor line, x), lobby-bookcase 84x384 (y 672; boards 8,
  16, 24 and 32 tiles up, under one-way-shelf rows 7 wide), lobby-sofa 120x72 (y 672; cushions 3 and 6 tiles up,
  under one-way-cushion rows 8 wide from x+12), lobby-desk 120x96 (y 672; its top 8 tiles up, under one-way-desk
  10 wide), lobby-plant 48x120 (y 672), lobby-lamp 48x192 (y 220, hung from the ceiling), lobby-window 96x240
  (y 552), lobby-front-door 156x180 (y 672: the inside of the front door, where she arrives; never a way back).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nature
import pixel
from PIL import Image
from pixel import Grid, darker, rgb

T = 12
COLUMNS = 8
W, H = 720, 360
FY = 312  # the sidewalk line inside a one-screen street piece (facades, storefronts)
STREET_FY = 600  # the street's sidewalk top (row 50): the street is 720px (60 tiles) tall, ground below
TILESETS = "public/art/tilesets"
BACKDROPS = "public/art/backdrops"
SPRITES = "public/art/sprites"


def rects(g, *rects):
    """Fill rects (x, y, w, h, colour or None) on a Grid in order."""
    for x, y, w, h, c in rects:
        g.rect(x, y, w, h, c)
    return g


def ends(g, kind, edge, lit=None, shade=None, below=0):
    """Exposed ends of a solid tile: a 1px edge, a 2px lit band (left) or shade band (right) from row `below`;
    a surface end drops its corner pixel."""
    if "l" in kind:
        rects(g, (0, 0, 1, T, edge))
        if lit:
            rects(g, (1, below, 2, T - below, lit))
        if "t" in kind:
            g.p(0, 0, None)
    if "r" in kind:
        rects(g, (T - 1, 0, 1, T, edge))
        if shade:
            rects(g, (T - 3, below, 2, T - below, shade))
        if "t" in kind:
            g.p(T - 1, 0, None)
    return g


def surface(g, edge, lip, body, under):
    return rects(g, (0, 0, T, T, body), (0, 0, T, 1, edge), (0, 1, T, 2, lip), (0, T - 2, T, 2, under))


def shelf(kind, edge, lip, top, face, bracket, bracket_sh):
    """One-way ledge: a 7px slab in the top rows, a bracket under each end tile, transparent below."""
    g = rects(
        Grid(T, T), (0, 0, T, 1, edge), (0, 1, T, 2, lip), (0, 3, T, 2, top), (0, 5, T, 1, face), (0, 6, T, 1, edge)
    )
    if kind == "l":
        rects(g, (0, 0, 1, 7, None), (1, 1, 1, 5, edge))
    if kind == "r":
        rects(g, (T - 1, 0, 1, 7, None), (T - 2, 1, 1, 5, edge))
    if kind in "lr":
        bx = 4 if kind == "l" else T - 6
        rects(g, (bx, 7, 2, 4, bracket), (bx, 11, 2, 1, bracket_sh))
    return g


# ---------------------------------------------------------------- the street's cool palette

# Zone 1 is a pale steel morning downtown. Its pieces are drawn with the warm ramp names in the functions below and
# recoloured at export through these maps, so their shapes, sizes and indices never depend on the palette. Colours
# a map does not name keep their own (the warm accents: cream sign icons, the amber door and cab, red, pink).
COOL_NEAR = {  # buildings, shopfronts and street furniture: muted blue-grey and slate
    "dbrown": "slate",
    "plum": "dslate",
    "brown": "grey",
    "rust": "slate",
    "ochre": "grey",
    "tan": "lgrey",
    "ink": "navy",
    "forest": "dslate",
    "teal": "dslate",
    "purple": "dslate",
    "dgreen": "slate",
    "green": "grey",
    "sky": "lgrey",
    "blue": "slate",
    "skin2": "grey",
    "skin1": "lgrey",
}
COOL_TILES = {  # play tiles: white lips, a light concrete band over a soft slate fill
    "skin1": "white",
    "skin2": "lgrey",
    "cream": "white",
    "tan": "lgrey",
    "brown": "slate",
    "dbrown": "navy",
    "plum": "dslate",
}
COOL_AWNING = {"dgreen": "ochre", "forest": "dbrown"}  # the awnings stay warm: ochre and cream
COOL_CANOPY = {"tan": "white", "forest": "dbrown"}  # the exit canopy: dark brown, a white lip
COOL_DOOR = {"tan": "slate", "cream": "grey", "brown": "dslate"}  # the exit's frame, darker so its amber glass
# glows and the sidewalk's lip holds under it


def recolour(g, mapping):
    """A copy of a Grid with each colour in mapping (K names) replaced by its target."""
    table = {pixel.hexc(a): pixel.hexc(b) for a, b in mapping.items()}
    out = Grid(g.w, g.h)
    out.px = [[table.get(c, c) if c else None for c in row] for row in g.px]
    return out


def cool(fn, mapping):
    return lambda: recolour(fn(), mapping)


# ---------------------------------------------------------------- street tiles

# Warm stone sidewalk, a cream stone kerb, a navy road; green-and-cream awnings; the hotel's forest-green canopy.
S = {
    "edge": "dbrown",
    "lip": "skin1",
    "body": "skin2",
    "under": "brown",
    "joint": "brown",
    "face": "brown",
    "face_lit": "skin2",
    "face_sh": "dbrown",
    "kerb": "cream",
    "kerb_lip": "white",
    "kerb_sh": "tan",
    "road": "navy",
    "road_lip": "dslate",
    "box": "brown",
    "box_lip": "tan",
    "box_sh": "dbrown",
    "box_edge": "dbrown",
}
AWNING = {"edge": "forest", "lip": "white", "a": "dgreen", "b": "cream"}
CANOPY = {"edge": "ink", "lip": "tan", "a": "forest", "b": "forest"}


def sidewalk(kind, joint=False):
    g = Grid(T, T)
    if "t" in kind:
        surface(g, S["edge"], S["lip"], S["body"], S["under"])
        if joint:
            rects(g, (T - 2, 3, 2, 7, S["joint"]))
        return ends(g, kind, S["edge"], S["lip"], S["under"], 1)
    rects(g, (0, 0, T, T, S["face"]))
    return ends(g, kind, S["edge"], S["face_lit"], S["face_sh"])


def kerb(side):
    g = rects(
        Grid(T, T),
        (0, 0, T, T, S["kerb"]),
        (0, 0, T, 1, S["edge"]),
        (0, 1, T, 2, S["kerb_lip"]),
        (0, T - 2, T, 2, S["kerb_sh"]),
    )
    ends(g, "t" + side, S["edge"], S["kerb_lip"], S["kerb_sh"], 1)
    if side == "l":
        g.p(1, 0, None), g.p(0, 1, None), g.p(1, 1, S["edge"])
    else:
        g.p(T - 2, 0, None), g.p(T - 1, 1, None), g.p(T - 2, 1, S["edge"])
    return g


def road(top):
    g = rects(Grid(T, T), (0, 0, T, T, S["road"]))
    if top:
        rects(g, (0, 0, T, 1, "ink"), (0, 1, T, 2, S["road_lip"]))
    return g


def awning(kind, p=AWNING):
    """A canvas awning seen front-on: a light lip, 4px stripes, a scalloped hem; art in the top 11 rows."""
    g = rects(Grid(T, T), (0, 0, T, 1, p["edge"]), (0, 1, T, 2, p["lip"]))
    for x in range(0, T, 4):
        rects(g, (x, 3, 4, 5, p["a"] if (x // 4) % 2 == 0 else p["b"]))
    for x in (0, 6):
        rects(g, (x, 8, 6, 1, p["a"]), (x + 1, 9, 4, 1, p["a"]), (x + 2, 10, 2, 1, p["edge"]))
        for px, py in ((x, 9), (x + 5, 9), (x + 1, 10), (x + 4, 10)):
            g.p(px, py, p["edge"])
    if kind == "l":
        rects(g, (0, 0, 1, 9, p["edge"]))
        g.p(0, 0, None)
    if kind == "r":
        rects(g, (T - 1, 0, 1, 9, p["edge"]))
        g.p(T - 1, 0, None)
    return g


def planter(kind):
    g = Grid(T, T)
    if "t" in kind:
        rects(
            g,
            (0, 0, T, T, S["box"]),
            (0, 0, T, 1, "forest"),
            (0, 1, T, 2, "green"),
            (0, 3, T, 3, "dgreen"),
            (0, 6, T, 1, S["box_edge"]),
            (0, 7, T, 2, S["box_lip"]),
        )
        if "l" in kind:
            rects(g, (0, 0, 1, T, S["box_edge"]), (0, 0, 1, 6, "forest"))
            g.p(0, 0, None), g.p(1, 0, None), g.p(1, 1, "forest")
        if "r" in kind:
            rects(g, (T - 1, 0, 1, T, S["box_edge"]), (T - 1, 0, 1, 6, "forest"), (T - 3, 9, 2, 3, S["box_sh"]))
            g.p(T - 1, 0, None), g.p(T - 2, 0, None), g.p(T - 2, 1, "forest")
        return g
    rects(g, (0, 0, T, T, S["box"]), (0, T - 1, T, 1, S["box_edge"]))
    return ends(g, kind, S["box_edge"], S["box_lip"], S["box_sh"])


def hotel_door():
    """The hotel's front door, 36x48: a pair of lit amber glass doors in a tan frame, the brightest thing at the
    door, so it reads as the way in."""
    g = rects(
        Grid(36, 48),
        (0, 0, 36, 48, "ink"),
        (1, 1, 34, 47, "tan"),
        (1, 1, 34, 2, "cream"),
        (1, 1, 2, 47, "cream"),
        (32, 3, 2, 45, "brown"),
        (5, 6, 26, 42, "ink"),
    )
    for x in (6, 19):
        rects(g, (x, 7, 11, 41, "amber"), (x, 30, 11, 18, "ochre"), (x + 1, 9, 2, 16, "yellow"))
    rects(g, (17, 6, 2, 42, "tan"), (14, 26, 2, 6, "brown"), (20, 26, 2, 6, "brown"))
    return g


# The cellar hatch: an open pit in the sidewalk with its two steel leaves standing up. Steel is the slate ramp
# (slate, dslate, navy): slate leaves read against the dark facades in greyscale, where dslate would not.
LEAF_H = 20  # leaf height above the sidewalk, in px


def hatch_edge(side):
    """The sidewalk tile beside the opening (side "l" for the hatch's left edge, "r" its right): a sidewalk end
    capped by a steel angle iron, its top lit, its flange running 5px down the shaft wall. Solid."""
    g = sidewalk("tr" if side == "l" else "tl")
    x = T - 4 if side == "l" else 0
    rects(g, (x, 0, 4, 3, "dslate"), (x, 0, 4, 1, "slate"))
    fx = T - 2 if side == "l" else 0
    rects(g, (fx, 3, 2, 5, "dslate"), (T - 1 if side == "l" else 0, 3, 1, 5, "navy"))
    return g


def pit():
    """The opening: the dark drop, ink to the bottom of the level. No collision."""
    return rects(Grid(T, T), (0, 0, T, T, "ink"))


def hatch_leaf():
    """The left leaf, standing on the left edge and leaning out 1px every 6 rows: a slate plate with dslate studs
    and a dslate hinge knuckle, ink-outlined, LEAF_H tall over 2 tile rows (24px) above the sidewalk."""
    g = Grid(T, 2 * T)
    for y in range(2 * T - LEAF_H, 2 * T):
        lean = (2 * T - 1 - y) // 6
        rects(g, (5 - lean, y, 6, 1, "slate"))
    for y in range(2 * T - LEAF_H + 2, 2 * T - 1, 4):
        lean = (2 * T - 1 - y) // 6
        rects(g, (5 - lean + (1 if (y // 4) % 2 else 3), y, 2, 2, "dslate"))
    rects(g, (9, 2 * T - 3, 2, 3, "dslate"))
    g.px = g.outlined(lambda _c: pixel.K["ink"])
    return g


def split_leaf(side):
    """The leaf as its top and bottom tiles, mirrored for the right edge."""
    g = hatch_leaf()
    if side == "r":
        g.px = pixel.flipped(g.px)
    top, bottom = Grid(T, T), Grid(T, T)
    top.px, bottom.px = g.px[:T], g.px[T:]
    return top, bottom


def cut(g, prefix):
    """A multi-tile drawing as named 12x12 tiles (prefix-0, prefix-1, ... in row order) and its piece rows."""
    tiles, rows = [], []
    for j in range(g.h // T):
        row = []
        for i in range(g.w // T):
            t = Grid(T, T)
            t.px = [r[i * T : (i + 1) * T] for r in g.px[j * T : (j + 1) * T]]
            name = f"{prefix}-{j * (g.w // T) + i}"
            tiles.append((name, t))
            row.append(name)
        rows.append(row)
    return tiles, rows


def street_tiles():
    door, door_rows = cut(hotel_door(), "door")
    return [
        ("sidewalk-top", sidewalk("t")),
        ("sidewalk-top-joint", sidewalk("t", True)),
        ("sidewalk-top-left", sidewalk("tl")),
        ("sidewalk-top-right", sidewalk("tr")),
        ("kerb-left", kerb("l")),
        ("kerb-right", kerb("r")),
        ("sidewalk-face", sidewalk("")),
        ("sidewalk-face-left", sidewalk("l")),
        ("sidewalk-face-right", sidewalk("r")),
        ("road-top", road(True)),
        ("road", road(False)),
        ("one-way-awning-left", awning("l")),
        ("one-way-awning", awning("m")),
        ("one-way-awning-right", awning("r")),
        ("one-way-canopy-left", awning("l", CANOPY)),
        ("one-way-canopy", awning("m", CANOPY)),
        ("one-way-canopy-right", awning("r", CANOPY)),
        ("planter-top-left", planter("tl")),
        ("planter-top", planter("t")),
        ("planter-top-right", planter("tr")),
        ("planter-left", planter("l")),
        ("planter", planter("")),
        ("planter-right", planter("r")),
        *door,
        *hatch_tiles(),
        *climb_tiles(),
    ], {"door": door_rows}


def street_tiles_cool():
    """The street's tiles in the cool palette: the awnings and the canopy keep their own accent maps, the door its
    frame map, every other tile the play map."""
    tiles, pieces = street_tiles()

    def m(name):
        if name.startswith("one-way-awning"):
            return COOL_AWNING
        if name.startswith("one-way-canopy"):
            return COOL_CANOPY
        if name.startswith("door-"):
            return COOL_DOOR
        return COOL_TILES

    return [(n, recolour(g, m(n))) for n, g in tiles], pieces


def hatch_tiles():
    """Appended after the door so every earlier index holds."""
    lt, lb = split_leaf("l")
    rt, rb = split_leaf("r")
    return [
        ("hatch-left", hatch_edge("l")),
        ("hatch-right", hatch_edge("r")),
        ("pit-opening", pit()),
        ("pit-leaf-left-top", lt),
        ("pit-leaf-left", lb),
        ("pit-leaf-right-top", rt),
        ("pit-leaf-right", rb),
    ]


def climb_tiles():
    """The climb up the street's buildings, appended after the hatch so every earlier index holds. Every top carries
    the same 2px cream lip under a 1px dark edge, so each ledge's top reads against any facade in greyscale."""
    tiles = []
    for name, fn in (("fire-escape", fire_escape_landing), ("sill", sill), ("cornice", cornice), ("tank", tank_top)):
        tiles += [(f"one-way-{name}-left", fn("l")), (f"one-way-{name}", fn("m")), (f"one-way-{name}-right", fn("r"))]
    return tiles


def ledge_ends(g, kind, edge, rows):
    """Round a one-way ledge's exposed end: a 1px edge down its side over rows, the top corner cut."""
    if kind == "l":
        rects(g, (0, 0, 1, rows, edge))
        g.p(0, 0, None)
    if kind == "r":
        rects(g, (T - 1, 0, 1, rows, edge))
        g.p(T - 1, 0, None)
    return g


def fire_escape_landing(kind):
    """A fire-escape landing: black iron with a sunlit cream lip, a 3px slatted deck and a navy underside; art in
    the top 7 rows."""
    g = rects(Grid(T, T), (0, 0, T, 1, "ink"), (0, 1, T, 2, "cream"), (0, 3, T, 3, "ink"), (0, 6, T, 1, "navy"))
    for x in (2, 6, 10):
        rects(g, (x, 4, 2, 1, "dslate"))  # the deck's slats, 2px
    return ledge_ends(g, kind, "ink", 7)


def sill(kind):
    """A stone window sill: a cream lip, tan stone, a brown face and a dark-brown underside; art in the top 7 rows.
    Lay 2 or 3 wide under a window."""
    g = rects(
        Grid(T, T),
        (0, 0, T, 1, "dbrown"),
        (0, 1, T, 2, "cream"),
        (0, 3, T, 2, "tan"),
        (0, 5, T, 1, "brown"),
        (0, 6, T, 1, "dbrown"),
    )
    return ledge_ends(g, kind, "dbrown", 7)


def cornice(kind):
    """A rooftop cornice: a cream lip, tan stone, a brown band and 2px tan dentils every 6px under it, the full tile
    tall."""
    g = rects(
        Grid(T, T),
        (0, 0, T, 1, "dbrown"),
        (0, 1, T, 2, "cream"),
        (0, 3, T, 3, "tan"),
        (0, 6, T, 1, "brown"),
        (0, 7, T, 4, "dbrown"),
        (0, 11, T, 1, "plum"),
    )
    for x in (2, 8):  # dentils, 2px wide every 6px
        rects(g, (x, 7, 2, 3, "tan"))
    return ledge_ends(g, kind, "dbrown", T)


def tank_top(kind):
    """The water tower's flat top rim: a cream lip over brown staves with a dark-brown hoop, the full tile tall, so
    it joins the tank in the water-tower backdrop below it."""
    g = rects(Grid(T, T), (0, 0, T, 1, "dbrown"), (0, 1, T, 2, "cream"), (0, 3, T, 9, "brown"), (0, 7, T, 2, "dbrown"))
    for x in (3, 9):
        rects(g, (x, 3, 1, 4, "dbrown"), (x, 9, 1, 3, "dbrown"))
    return ledge_ends(g, kind, "dbrown", T)


# ---------------------------------------------------------------- lobby tiles

# The boutique lobby: wood walls a step darker than everything she stands on. Every walkable top, the floor and
# each one-way ledge, carries the same 2px cream lip under a 1px plum edge, so in greyscale the standable edges
# are the brightest lines in the room. Indoor scale: a door is 180px (15 tiles).
LE = "plum"
LOBBY_H = 720  # a level is 2 screens (60 tiles) tall
LOBBY_FY = 672  # the lobby floor line (tile row 56)


def floor(kind, joint=False):
    """Wood floor: a cream lip, brown boards with a 2px dark-brown board end every 24px, a dark-brown face."""
    g = Grid(T, T)
    if "t" in kind:
        surface(g, LE, "cream", "brown", "dbrown")
        if joint:
            rects(g, (T - 2, 3, 2, 7, "dbrown"))
        return ends(g, kind, LE, "cream", "dbrown", 1)
    rects(g, (0, 0, T, T, "dbrown"))
    return ends(g, kind, LE, "brown", "plum")


# one-way ledge styles: lip, top, face, bracket (None: no brackets)
LEDGES = {
    "balcony": ("cream", "tan", "brown", None),  # the mezzanine floor's front edge
    "shelf": ("cream", "tan", "brown", "dbrown"),  # bookcase and wall shelves
    "cushion": ("cream", "mauve", "purple", None),  # the sofa's seat and back
    "desk": ("cream", "tan", "dbrown", None),  # the reception desk's top
}


def ledge(style, kind):
    lip, top, face, bracket = LEDGES[style]
    g = rects(Grid(T, T), (0, 0, T, 1, LE), (0, 1, T, 2, lip), (0, 3, T, 2, top), (0, 5, T, 1, face), (0, 6, T, 1, LE))
    if kind == "l":
        rects(g, (0, 0, 1, 7, None), (1, 1, 1, 5, LE))
    if kind == "r":
        rects(g, (T - 1, 0, 1, 7, None), (T - 2, 1, 1, 5, LE))
    if bracket and kind in "lr":
        bx = 4 if kind == "l" else T - 6
        rects(g, (bx, 7, 2, 4, bracket), (bx, 11, 2, 1, LE))
    return g


def post(kind):
    """A wood post, 2 tiles wide: brown with a tan lit band and a dark-brown shade; cream-capped cap and base."""
    left = kind.endswith("l")
    g = rects(Grid(T, T), (0, 0, T, T, "brown"))
    if left:
        rects(g, (0, 0, 1, T, LE), (1, 0, 2, T, "tan"))
    else:
        rects(g, (T - 3, 0, 2, T, "dbrown"), (T - 1, 0, 1, T, LE))
    if kind.startswith("cap"):
        rects(g, (0, 0, T, 1, LE), (0, 1, T, 2, "cream"), (0, 3, T, 3, "tan"), (0, 6, T, 1, LE))
    if kind.startswith("base"):
        rects(g, (0, 4, T, 1, LE), (0, 5, T, 2, "cream"), (0, 7, T, 5, "tan"))
    if kind.startswith(("cap", "base")):
        rects(g, (0, 0, 1, T, LE) if left else (T - 1, 0, 1, T, LE))
    return g


def stairwell():
    """The exit to the next floor, 84x180 (a door at indoor scale): a tan frame round an opening with stairs
    rising to the right, and a white up-arrow on a green sign over it."""
    g = rects(
        Grid(84, 180),
        (0, 0, 84, 180, LE),
        (2, 2, 80, 178, "tan"),
        (2, 2, 4, 178, "cream"),
        (76, 6, 4, 174, "brown"),
        (22, 6, 40, 24, "forest"),
        (24, 8, 36, 20, "dgreen"),
        (10, 36, 64, 144, "ink"),
        (12, 38, 60, 142, "navy"),
    )
    for k in range(6):
        rects(g, (41 - k * 2, 11 + k * 2, 2 + k * 4, 2, "white"))
    rects(g, (39, 23, 6, 4, "white"))
    for i in range(6):
        sx, sy = 12 + i * 10, 166 - i * 22
        rects(g, (sx, sy, 72 - sx, 180 - sy, "dslate"), (sx, sy, 72 - sx, 4, "slate"))
    rects(g, (12, 38, 60, 8, "ink"))
    return g


def lobby_tiles():
    tiles = [
        ("floor-top", floor("t")),
        ("floor-top-joint", floor("t", True)),
        ("floor-top-left", floor("tl")),
        ("floor-top-right", floor("tr")),
        ("floor-face", floor("")),
        ("floor-face-left", floor("l")),
        ("floor-face-right", floor("r")),
    ]
    for style in LEDGES:
        tiles += [
            (f"one-way-{style}-left", ledge(style, "l")),
            (f"one-way-{style}", ledge(style, "m")),
            (f"one-way-{style}-right", ledge(style, "r")),
        ]
    tiles += [
        ("post-cap-left", post("cap-l")),
        ("post-cap-right", post("cap-r")),
        ("post-left", post("l")),
        ("post-right", post("r")),
        ("post-base-left", post("base-l")),
        ("post-base-right", post("base-r")),
    ]
    exit_tiles, exit_rows = cut(stairwell(), "exit")
    return tiles + exit_tiles, {"exit": exit_rows}


TILESET_DEFS = (("tiles-street", street_tiles_cool), ("tiles-lobby", lobby_tiles))


def tileset_image(tiles):

    rows = -(-len(tiles) // COLUMNS)
    im = Image.new("RGBA", (COLUMNS * T, rows * T), (0, 0, 0, 0))
    for i, (_, g) in enumerate(tiles):
        im.alpha_composite(frame_image(g.px), ((i % COLUMNS) * T, (i // COLUMNS) * T))
    return im


# ---------------------------------------------------------------- backdrops

# Sign icons, 11x11, one colour on a navy board. Signs are icons, never text.
ICONS = {
    "cafe": [
        "..#..#.....",
        "...#..#....",
        "..#..#.....",
        "...........",
        "#########..",
        "#########.#",
        "#########.#",
        "#########.#",
        ".#######.#.",
        "..#####....",
        "###########",
    ],
    "florist": [
        "...##.##...",
        "..########.",
        "..###..###.",
        "...##.##...",
        ".....#.....",
        ".##..#..##.",
        "..##.#.##..",
        "....###....",
        ".....#.....",
        "..#######..",
        "...#####...",
    ],
    "gift-shop": [
        "..##...##..",
        "...##.##...",
        "....###....",
        "###########",
        "#....#....#",
        "###########",
        ".#...#...#.",
        ".#...#...#.",
        ".#...#...#.",
        ".#...#...#.",
        ".#########.",
    ],
    "makeup-store": [
        "....###....",
        "...####....",
        "...#####...",
        "...#####...",
        "...#####...",
        "..#######..",
        "..#.....#..",
        "..#######..",
        "..#.....#..",
        "..#.....#..",
        "..#######..",
    ],
    "pet-shop": [
        "...........",
        "..##...##..",
        "..##...##..",
        "##.......##",
        "##.......##",
        "....###....",
        "...#####...",
        "..#######..",
        "..#######..",
        "...##.##...",
        "...........",
    ],
    "diner": [
        "#.#.#...##.",
        "#.#.#...###",
        "#.#.#...###",
        "#####...###",
        ".###....###",
        "..#.....##.",
        "..#......#.",
        "..#......#.",
        "..#......#.",
        "..#......#.",
        "..#......#.",
    ],
    "noodle-bar": [
        ".........#.",
        "........#..",
        ".......#.#.",
        "......#.#..",
        ".....#.#...",
        "###########",
        "###########",
        ".#########.",
        "..#######..",
        "...#####...",
        "..#######..",
    ],
    "hotel": [
        "....#.#....",
        "...#####...",
        "..#.###.#..",
        ".#########.",
        "###########",
        "#.#.#.#.#.#",
        "#.#.#.#.#.#",
        "#.#.#.#.#.#",
        "#.#.#.#.#.#",
        "###########",
        "###########",
    ],
}

# kind: width (whole tiles), frame colour. Frames are dim so the shops stay behind the play layer.
SHOPS = {
    "cafe": (84, "forest"),
    "florist": (84, "plum"),
    "gift-shop": (96, "teal"),
    "makeup-store": (96, "purple"),
    "pet-shop": (108, "navy"),
    "diner": (108, "plum"),
    "noodle-bar": (120, "teal"),
}

# Building facades: wall, line (storey lines, frames, mortar), trim (sills, parapet).
BUILDINGS = {
    "one-storey": ("dbrown", "plum", "brown"),
    "walkup": ("dbrown", "plum", "brown"),
    "brownstone": ("plum", "ink", "dbrown"),
    "hotel": ("dslate", "navy", "tan"),
}


def icon(g, kind, x, y, c):
    for j, row in enumerate(ICONS[kind]):
        for i, ch in enumerate(row):
            if ch == "#":
                g.p(x + i, y + j, c)


def street_sky():
    """48x600, repeat x: one flat powder-blue atmosphere, fixed behind the scrolling city layers."""
    return rects(Grid(48, STREET_FY), (0, 0, 48, STREET_FY, "zone-blue"))


def city_blocks(g, colour, blocks):
    """Window-free silhouettes, with occasional small water tanks, on a seamless 720px repeat."""
    for x, width, top, tank in blocks:
        rects(g, (x, top, width, STREET_FY - top, colour))
        if tank:
            rects(
                g, (x + 12, top - 18, 18, 14, colour), (x + 14, top - 4, 2, 4, colour), (x + 26, top - 4, 2, 4, colour)
            )
            g.tri((x + 10, top - 18), (x + 21, top - 26), (x + 32, top - 18), colour)
    return g


def street_city_far():
    """720x600 repeating window-free city masses, softened by the canonical powder-blue haze."""
    g = city_blocks(
        Grid(720, STREET_FY),
        "zone-blue-shade",
        (
            (0, 112, 350, False),
            (138, 70, 292, True),
            (228, 104, 324, False),
            (356, 82, 248, False),
            (462, 108, 338, False),
            (594, 126, 304, True),
        ),
    )
    rects(
        g,
        (18, 332, 60, 18, "zone-blue-shade"),
        (374, 228, 46, 20, "zone-blue-shade"),
        (482, 322, 68, 16, "zone-blue-shade"),
    )
    return g


def street_city_mid():
    """720x600 repeating complete low-rise blocks, varied roof masses and broad quiet recesses."""
    g = city_blocks(
        Grid(720, STREET_FY),
        "slate",
        (
            (20, 138, 442, False),
            (208, 110, 406, False),
            (372, 144, 462, False),
            (572, 126, 424, False),
        ),
    )
    rects(
        g,
        (28, 434, 122, 8, "slate"),
        (224, 394, 78, 12, "slate"),
        (390, 450, 108, 12, "slate"),
        (584, 412, 102, 12, "slate"),
        (40, 480, 96, 12, "zone-blue-shade"),
        (230, 450, 66, 10, "zone-blue-shade"),
        (398, 496, 92, 10, "zone-blue-shade"),
    )
    return g


def street_boundary_mid():
    """720x600 repeating low service roofs with broad gaps revealing the city beyond; no play lips."""
    g = city_blocks(
        Grid(720, STREET_FY),
        "slate",
        (
            (32, 160, 504, False),
            (292, 104, 532, False),
            (520, 168, 492, False),
        ),
    )
    rects(
        g,
        (48, 494, 128, 10, "slate"),
        (542, 480, 124, 12, "slate"),
        (52, 536, 116, 10, "zone-blue-shade"),
        (544, 526, 120, 10, "zone-blue-shade"),
    )
    return g


def street_skyline():
    """336x600 legacy composite for callers without separate far and middle layers. Do not place with both
    street-city-far and street-city-mid: those two keys replace this combined backdrop."""
    far, middle = street_city_far(), street_city_mid()
    g = Grid(336, STREET_FY)
    g.px = [[middle.px[y][x] or far.px[y][x] for x in range(g.w)] for y in range(g.h)]
    return g


def facade(kind):
    """One repeating 48px slice of a building front from the top of the screen to the sidewalk line: the ground
    storey is 180px (y 132 to 312) with a band at y 206 over the shopfronts; above it the next storey's windows.
    The one-storey building stops at a parapet at y 120."""
    wall, line, trim = BUILDINGS[kind]
    if kind == "one-storey":
        return rects(
            Grid(48, 192), (0, 0, 48, 192, wall), (0, 0, 48, 6, trim), (0, 6, 48, 4, line), (0, 86, 48, 4, line)
        )
    g = rects(Grid(48, FY), (0, 0, 48, FY, wall), (0, 124, 48, 8, line), (0, 122, 48, 2, trim), (0, 206, 48, 4, line))
    rects(g, (11, 50, 26, 58, line), (14, 53, 20, 52, "navy"), (23, 53, 2, 52, line), (9, 108, 30, 4, trim))
    if kind == "brownstone":
        rects(g, (9, 44, 30, 6, trim))  # a stone lintel over each window
    return g


def fire_escape():
    """196x185, bottom at y 473: an ink platform and railing under the second-storey windows, a stair up out of
    the screen and a drop ladder hanging towards the sidewalk."""
    g = Grid(196, 185)
    rects(g, (0, 112, 196, 3, "ink"), (0, 92, 196, 2, "ink"))
    for px in range(0, 196, 18):
        rects(g, (px, 92, 2, 22, "ink"))
    for k in range(46):  # the stair, a 2px diagonal
        rects(g, (20 + k, 92 - 2 * k, 2, 2, "ink"))
    rects(g, (136, 115, 2, 70, "ink"), (148, 115, 2, 70, "ink"))
    for ry in range(121, 185, 8):
        rects(g, (136, ry, 14, 2, "ink"))
    return g


def hotel_crest():
    """98x44, bottom at y 478: two banners on short poles either side of a navy plaque with the hotel's crest."""
    g = Grid(98, 44)
    for x, c in ((4, "navy"), (82, "dgreen")):
        rects(g, (x - 4, 0, 20, 2, "ink"), (x, 2, 12, 34, c), (x + 2, 36, 8, 4, c), (x, 2, 12, 2, "cream"))
    rects(g, (32, 4, 32, 26, "ink"), (33, 5, 30, 24, "navy"), (24, 42, 48, 2, "tan"))
    icon(g, "hotel", 43, 11, "cream")
    return g


def hotel_window():
    """32x152, bottom at y 592: a tall ground-storey window."""
    return rects(
        Grid(32, 152), (0, 0, 32, 152, "navy"), (3, 3, 26, 146, "ink"), (3, 48, 26, 2, "navy"), (6, 8, 4, 30, "dslate")
    )


def storefront(kind):
    """A shopfront, w x 120 (y 192 to 312): a frame in the shop's colour, a navy sign board with its icon, a tall
    display window under a transom, and a 46px door under its own transom. An awning (one-way, row 20) fits across
    it below the sign."""
    w, frame = SHOPS[kind]
    edge = darker(frame)
    g = rects(
        Grid(w, 120),
        (0, 0, w, 120, frame),
        (4, 2, w - 8, 18, "ink"),
        (5, 3, w - 10, 16, "navy"),
        (4, 26, w - 34, 86, edge),
        (6, 28, w - 38, 82, "dslate"),
        (6, 44, w - 38, 2, edge),
        (10, 50, 2, 24, "slate"),
        (14, 50, 2, 12, "slate"),
        (w - 28, 26, 24, 94, edge),
        (w - 26, 28, 20, 42, "dslate"),
        (w - 26, 74, 20, 46, edge),
        (w - 23, 78, 14, 18, "dslate"),
    )
    icon(g, kind, w // 2 - 5, 6, "cream")
    return g


def cab():
    """96x40: a yellow cab side-on, for the far avenue down a cross street."""
    g = rects(
        Grid(96, 40),
        (16, 6, 52, 12, "amber"),
        (20, 8, 20, 8, "navy"),
        (44, 8, 20, 8, "navy"),
        (36, 0, 12, 6, "cream"),
        (0, 18, 96, 14, "amber"),
        (0, 28, 96, 4, "orange"),
    )
    for wx in (12, 70):
        rects(g, (wx, 30, 14, 10, "ink"), (wx + 4, 34, 6, 2, "dslate"))
    return g


def hot_dog_cart():
    """40x70: a steel cart on two wheels under a blue-and-cream umbrella."""
    g = Grid(40, 70)
    g.ell(20, 12, 20, 12, "blue")
    rects(
        g,
        (0, 12, 40, 12, None),
        (8, 4, 6, 8, "cream"),
        (24, 4, 6, 8, "cream"),
        (18, 12, 2, 34, "ink"),
        (0, 44, 40, 18, "slate"),
        (0, 44, 40, 3, "white"),
    )
    for wx in (4, 28):
        g.ell(wx + 4, 64, 4, 4, "ink")
    return g


def subway_railing():
    """72x62: a green railing round the stairs down, with a green lamp on a post at each end."""
    g = rects(Grid(72, 62), (3, 40, 66, 2, "forest"), (3, 40, 2, 22, "forest"), (67, 40, 2, 22, "forest"))
    for bx in range(11, 66, 8):
        rects(g, (bx, 42, 2, 20, "forest"))
    for px in (3, 67):
        rects(g, (px, 8, 2, 32, "forest"), (px - 3, 0, 8, 8, "dgreen"))
    return g


def street_tree():
    """64x136: branching street tree with an irregular sage crown, without a dark contour."""

    im = Image.new("RGBA", (64, 136))
    nature.broadleaf(im, 0, 0, 64, 84, 136, "zone-green-shade", "zone-peach-shade", 7, seed=5)
    g = Grid(64, 136)
    g.px = [
        [("{:02x}{:02x}{:02x}".format(*im.getpixel((x, y))[:3])) if im.getpixel((x, y))[3] else None for x in range(64)]
        for y in range(136)
    ]
    return g


def walk_signal():
    """12x82: a pole with the signal box at the top showing the white walking figure."""
    return rects(
        Grid(12, 82),
        (4, 6, 2, 76, "ink"),
        (0, 0, 10, 12, "ink"),
        (4, 2, 2, 2, "white"),
        (3, 4, 4, 4, "white"),
        (3, 8, 1, 3, "white"),
        (6, 8, 1, 3, "white"),
    )


def doorman_podium():
    return rects(Grid(18, 24), (2, 2, 14, 22, "dbrown"), (0, 0, 18, 4, "tan"))


def canopy_poles():
    """60x60: the two tan poles holding up the hotel canopy, set under its end tiles."""
    return rects(Grid(60, 60), (2, 0, 2, 60, "tan"), (56, 0, 2, 60, "tan"))


def cross_street():
    """120x26: the far avenue seen down a cross street, navy with 2px lane dashes; the sky and skyline show above."""
    g = rects(Grid(120, 26), (0, 0, 120, 26, "navy"))
    for x in range(8, 120, 24):
        rects(g, (x, 12, 8, 2, "dslate"))
    return g


def facade_upper(kind):
    """One upper storey of a building front, 48x180, repeat x: the same windows, sills and storey line as the top of
    the building's facade piece, so it stacks above it every 180px with no seam."""
    base = facade(kind)
    g = Grid(48, 180)
    g.px = [row[:] for row in base.px[:180]]
    return g


def roofline(kind):
    """The top of a building, 48x48, repeat x: plain wall under a 4px trim band at the top, placed on the topmost
    facade piece; one-way-cornice tiles go along its top edge, where the roof is."""
    wall, line, trim = BUILDINGS[kind]
    return rects(Grid(48, 48), (0, 0, 48, 48, wall), (0, 0, 48, 4, trim), (0, 4, 48, 2, line))


def fire_escape_railing():
    """48x24, repeat x: a fire-escape landing's ink railing, a top rail and 2px balusters every 12px, standing on
    the landing (its bottom at the landing tiles' top edge)."""
    g = rects(Grid(48, 24), (0, 0, 48, 2, "ink"), (0, 10, 48, 2, "ink"))
    for x in (0, 12, 24, 36):
        rects(g, (x, 0, 2, 24, "ink"))
    return g


# Fire-escape ladders, one per landing spacing in rows: fire-escape-ladder is 8 rows, fire-escape-ladder-<n> n rows.
LADDER_ROWS = (4, 5, 6, 7)


def fire_escape_ladder(rows=8):
    """24 x 12*rows (2 x rows tiles): an ink ladder between two landings rows apart, 2px rails and 2px rungs every
    8px; backdrop, so it does not collide. Place the one whose rows match the spacing with its bottom at the lower
    landing's top edge (y = lower row * 12) and its left edge on the landing's ladder column; its top then meets the
    upper landing's top edge, where the landing tile covers it."""
    h = 12 * rows
    g = rects(Grid(24, h), (4, 0, 2, h, "ink"), (18, 0, 2, h, "ink"))
    for y in range(4, h, 8):
        rects(g, (4, y, 16, 2, "ink"))
    return g


def water_tower():
    """48x84 (4x7 tiles), bottom on a roof: a shallow cone roof (the top tile row), a wooden tank with two hoops
    and dark-brown legs. Lay one-way-tank tiles (4 wide) on its second tile row, the tank's flat top, 6 tiles above
    the roof."""
    g = rects(
        Grid(48, 84),
        (0, 12, 48, 48, "brown"),
        (0, 26, 48, 2, "dbrown"),
        (0, 44, 48, 2, "dbrown"),
        (0, 58, 48, 2, "dbrown"),
    )
    for x in (11, 23, 35):
        rects(g, (x, 12, 1, 46, "dbrown"))  # staves
    for k in range(4):  # the cone, stepping in 2px a row pair
        rects(g, (8 + 4 * k, 10 - 2 * k, 32 - 8 * k, 2, "plum"))
    for x in (4, 20, 26, 42):
        rects(g, (x, 60, 2, 24, "dbrown"))  # legs
    rects(g, (4, 70, 40, 2, "dbrown"))  # a brace
    return g


def lobby_wall():
    """48x720, repeat x, bottom at y 720: dark-brown wood panelling with 2px plum grooves every 24px, a plum and
    ink ceiling cornice, a plum wainscot from y 588 under a 2px brown rail. Below the floor line it is covered by
    the floor tiles."""
    g = rects(Grid(48, LOBBY_H), (0, 0, 48, LOBBY_H, "dbrown"), (0, 0, 48, 20, "plum"), (0, 20, 48, 4, "ink"))
    for x in (10, 34):
        rects(g, (x, 24, 2, 564, "plum"))
    rects(g, (0, 588, 48, 84, "plum"), (0, 586, 48, 2, "brown"))
    return g


def lobby_bookcase():
    """84x384 (7x32 tiles), bottom at y 672: a tall bookcase, a brown frame round a plum back, one step from the
    wall. Its boards sit 8, 16, 24 and 32 tiles above the floor, where one-way-shelf tiles go (7 wide); muted books
    stand on each board."""
    g = rects(Grid(84, 384), (0, 0, 84, 384, "brown"), (4, 4, 76, 380, "plum"))
    for k in range(4):
        rects(g, (0, 384 - 96 * (k + 1), 84, 7, "brown"))  # the boards
    for k, base in enumerate((384, 288, 192, 96)):  # books standing on the floor and each lower board
        for i, bx in enumerate(range(8, 76, 6)):  # 4px spines, stepped heights, muted colours
            hgt = (34, 40, 28, 44, 36, 30, 42, 26, 38, 32, 44)[i % 11]
            c = ("teal", "dbrown", "forest", "navy", "purple", "dbrown")[(i + k) % 6]
            rects(g, (bx, base - hgt, 4, hgt, c))
    return g


def lobby_sofa():
    """120x72 (10x6 tiles), bottom at y 672: a purple sofa. Its seat top is 3 tiles up (a hop) and its back 6;
    lay one-way-cushion tiles on both, 8 wide over the cushions (x 12 to 108), inside the 1-tile arms."""
    return rects(
        Grid(120, 72),
        (12, 0, 96, 64, "purple"),
        (59, 6, 2, 30, "plum"),
        (12, 36, 96, 2, "plum"),
        (12, 60, 96, 4, "plum"),
        (0, 24, 12, 40, "purple"),
        (108, 24, 12, 40, "purple"),
        (0, 24, 12, 4, "mauve"),
        (108, 24, 12, 4, "mauve"),
        (10, 24, 2, 40, "plum"),
        (108, 24, 2, 40, "plum"),
        (12, 64, 8, 8, "plum"),
        (100, 64, 8, 8, "plum"),
    )


def lobby_plant():
    """48x120, bottom at y672: branching indoor foliage with pointed leaves in a dark pot."""
    g = rects(Grid(48, 120), (8, 84, 32, 36, "plum"), (6, 80, 36, 6, "dbrown"))
    g.line(24, 79, 22, 10, "zone-green-shade")
    g.line(25, 79, 23, 10, "zone-green-shade")
    for x, y, joint in ((4, 14, 36), (39, 2, 26), (2, 40, 57), (45, 30, 53), (8, 61, 74), (42, 55, 75)):
        side = -1 if x < 24 else 1
        g.line(24, joint, x, y, "zone-green-shade")
        g.tri((x, y), (x - side * 8, y + 18), (24, joint), "forest")
        g.tri((x, y), (x + side * 4, y + 11), (24, joint), "zone-green-shade")
    return g


def lobby_lamp():
    """48x192, bottom at y 220: a pendant lamp on a cord from the ceiling, a tan drum shade with its bulb lit
    (white core, cream ring). No glow is baked in: lights are data."""
    return rects(
        Grid(48, 192),
        (23, 0, 2, 166, "ink"),
        (4, 166, 40, 20, "tan"),
        (4, 166, 40, 2, "cream"),
        (4, 184, 40, 2, "brown"),
        (18, 186, 12, 6, "cream"),
        (20, 186, 8, 4, "white"),
    )


def lobby_window():
    """96x240, bottom at y 552: a tall window onto the bright day, plum frame and bars."""
    return rects(
        Grid(96, 240),
        (0, 0, 96, 240, "plum"),
        (4, 4, 88, 232, "blue"),
        (46, 4, 4, 232, "plum"),
        (4, 118, 88, 4, "plum"),
        (10, 10, 6, 60, "sky"),
        (56, 10, 6, 40, "sky"),
    )


def lobby_desk():
    """120x96 (10x8 tiles), bottom at y 672: the reception desk, dark-brown with plum panels. Its top is 8 tiles
    up, a full jump; lay one-way-desk tiles (10 wide) on it."""
    g = rects(Grid(120, 96), (0, 0, 120, 96, "dbrown"), (0, 90, 120, 6, "plum"))
    for x in (8, 46, 84):
        rects(g, (x, 12, 28, 70, "plum"))
    return g


def lobby_front_door():
    """156x180, bottom at y 672: the inside of the hotel's front door, where she arrives from the street. Not a
    way back (a level is never revisited): a tan frame, a transom, two glass doors onto the bright street."""
    g = rects(
        Grid(156, 180),
        (0, 0, 156, 180, LE),
        (2, 2, 152, 178, "brown"),
        (2, 2, 152, 4, "tan"),
        (12, 12, 132, 168, "ink"),
        (14, 14, 128, 34, "blue"),
        (76, 14, 4, 34, "brown"),
        (12, 48, 132, 4, "brown"),
        (76, 52, 4, 128, "brown"),
        (12, 166, 132, 14, "plum"),
    )
    for x in (14, 80):
        rects(
            g,
            (x, 54, 62, 112, "blue"),
            (x + 6, 60, 8, 70, "sky"),
            (x + 18, 60, 4, 40, "sky"),
            (x, 54, 62, 3, "brown"),
            (x + (52 if x == 14 else 4), 110, 6, 22, "dbrown"),
        )
    return g


def lobby_balustrade():
    """48x36, repeat x, bottom at the mezzanine's floor line: brown balusters every 12px under a brown rail."""
    g = rects(Grid(48, 36), (0, 0, 48, 4, "brown"))
    for x in (4, 16, 28, 40):
        rects(g, (x, 4, 4, 32, "brown"))
    return g


# key: (draw, anchor y, repeat)
STREET_DEFS = {
    "street-sky": (street_sky, STREET_FY, "x"),
    "street-skyline": (street_skyline, STREET_FY, "x"),
    "street-city-far": (street_city_far, STREET_FY, "x"),
    "street-city-mid": (street_city_mid, STREET_FY, "x"),
    "street-boundary-mid": (street_boundary_mid, STREET_FY, "x"),
    **{f"facade-{k}": ((lambda k=k: facade(k)), STREET_FY, "x") for k in BUILDINGS},
    "fire-escape": (fire_escape, 473, "none"),
    "hotel-crest": (hotel_crest, 478, "none"),
    "hotel-window": (hotel_window, 592, "none"),
    **{f"storefront-{k}": ((lambda k=k: storefront(k)), STREET_FY, "none") for k in SHOPS},
    "cab": (cab, STREET_FY, "none"),
    "hot-dog-cart": (hot_dog_cart, STREET_FY, "none"),
    "subway-railing": (subway_railing, STREET_FY, "none"),
    "street-tree": (street_tree, STREET_FY, "none"),
    "walk-signal": (walk_signal, STREET_FY, "none"),
    "doorman-podium": (doorman_podium, STREET_FY, "none"),
    "canopy-poles": (canopy_poles, STREET_FY, "none"),
    "cross-street": (cross_street, STREET_FY, "none"),
    **{f"facade-{k}-upper": ((lambda k=k: facade_upper(k)), 288, "x") for k in ("walkup", "brownstone", "hotel")},
    **{f"roofline-{k}": ((lambda k=k: roofline(k)), 108, "x") for k in ("walkup", "brownstone", "hotel")},
    "fire-escape-railing": (fire_escape_railing, 432, "x"),
    "fire-escape-ladder": (fire_escape_ladder, 432, "none"),
    **{f"fire-escape-ladder-{n}": ((lambda n=n: fire_escape_ladder(n)), 432, "none") for n in LADDER_ROWS},
    "water-tower": (water_tower, 240, "none"),
}
# the street's pieces in the cool palette; the sky and skyline are drawn in it already
# pieces standing on the sidewalk keep the line just above it darker than the sidewalk's white lip: the tree's
# trunk and the canopy's poles take grey, not lgrey
NEAR_FOR = {"street-tree": dict(COOL_NEAR, tan="grey"), "canopy-poles": dict(COOL_NEAR, tan="grey")}
# Quiet glass stays one value step below the architecture; shop icons keep their cream callout.
for _key in STREET_DEFS:
    if _key.startswith(("facade-", "storefront-")):
        NEAR_FOR[_key] = dict(COOL_NEAR, navy="dslate")
ATMOSPHERE_KEYS = ("street-sky", "street-skyline", "street-city-far", "street-city-mid", "street-boundary-mid")
BACKDROP_DEFS = {
    k: (fn if k in ATMOSPHERE_KEYS else cool(fn, NEAR_FOR.get(k, COOL_NEAR)), y, rep)
    for k, (fn, y, rep) in STREET_DEFS.items()
}
BACKDROP_DEFS.update(
    {
        "lobby-wall": (lobby_wall, LOBBY_H, "x"),
        "lobby-balustrade": (lobby_balustrade, 288, "x"),
        "lobby-bookcase": (lobby_bookcase, LOBBY_FY, "none"),
        "lobby-sofa": (lobby_sofa, LOBBY_FY, "none"),
        "lobby-desk": (lobby_desk, LOBBY_FY, "none"),
        "lobby-plant": (lobby_plant, LOBBY_FY, "none"),
        "lobby-lamp": (lobby_lamp, 220, "none"),
        "lobby-window": (lobby_window, 552, "none"),
        "lobby-front-door": (lobby_front_door, LOBBY_FY, "none"),
    }
)


# ---------------------------------------------------------------- export


def frame_image(px):

    h, w = len(px), len(px[0])
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), (*rgb(c), 255))
    return im


def build():
    Path(TILESETS).mkdir(parents=True, exist_ok=True)
    Path(BACKDROPS).mkdir(parents=True, exist_ok=True)
    tilesets, backdrops = [], []
    for key, fn in TILESET_DEFS:
        tiles, pieces = fn()
        tilesets.append(pixel.write_tileset(key, [(n, frame_image(g.px)) for n, g in tiles], pieces))
    for key, (fn, y, repeat) in BACKDROP_DEFS.items():
        g = fn()
        frame_image(g.px).save(f"{BACKDROPS}/{key}.png")
        backdrops.append(
            {
                "key": key,
                "png": f"backdrops/{key}.png",
                "width": g.w,
                "height": g.h,
                "anchor": "bottom-left",
                "y": y,
                "repeat": repeat,
            }
        )
    # merged by key, so the park theme's entries stay; a piece floor1.py stops drawing is removed by hand
    pixel.update_manifest("tilesets", tilesets)
    pixel.update_manifest("backdrops", backdrops)
    print("built", ", ".join(k for k, _ in TILESET_DEFS), "and", len(backdrops), "backdrops")


# ---------------------------------------------------------------- preview: example layouts

# One example street for the preview only: a 720x720 column (60x60 tiles, two screens tall) with the sidewalk along
# the bottom (its top at row 50, y 600, ground below) and a climb to the roof, built to the reaches (a hop rises 3
# tiles, a full
# jump 8). Backdrop runs are (key, x0, x1, bottom y); pieces (key, x, bottom y); one-way rows (tile, row, first
# col, width).
STREET_EXAMPLE = {
    "runs": [
        ("street-sky", 0, 720, STREET_FY),
        ("street-city-far", 0, 720, STREET_FY),
        ("street-city-mid", 0, 720, STREET_FY),
        ("facade-walkup", 0, 288, STREET_FY),
        ("facade-walkup-upper", 0, 288, 288),
        ("roofline-walkup", 0, 288, 108),
        ("facade-brownstone", 288, 528, STREET_FY),
        ("roofline-brownstone", 288, 528, 288),
        ("facade-one-storey", 528, 720, STREET_FY),
        ("fire-escape-railing", 72, 216, 432),
        ("fire-escape-railing", 72, 216, 336),
        ("fire-escape-railing", 72, 216, 240),
        ("fire-escape-railing", 72, 216, 156),
    ],
    "pieces": [
        ("storefront-pet-shop", 12, STREET_FY),
        ("storefront-makeup-store", 156, STREET_FY),
        ("storefront-gift-shop", 300, STREET_FY),
        ("storefront-diner", 408, STREET_FY),
        ("storefront-cafe", 588, STREET_FY),
        ("fire-escape-ladder", 192, 432),
        ("fire-escape-ladder", 192, 336),
        ("fire-escape-ladder", 192, 240),
        ("water-tower", 456, 240),
        ("street-tree", 456, STREET_FY),
    ],
    "ledges": [
        ("awning", 44, 24, 6),
        ("fire-escape", 36, 6, 12),
        ("fire-escape", 28, 6, 12),
        ("fire-escape", 20, 6, 12),
        ("fire-escape", 13, 6, 12),
        ("cornice", 5, 0, 24),
        ("tank", 14, 38, 4),
        ("sill", 33, 29, 3),
        ("sill", 33, 37, 3),
        ("cornice", 20, 24, 20),
    ],
    "planter": (20, 3),
}


def compose(im, defs, runs, pieces):

    images = {}

    def art(key):
        if key not in images:
            images[key] = frame_image(defs[key][0]().px)
        return images[key]

    for key, x0, x1, y in runs:
        p = art(key)
        for x in range(x0, x1, p.width):
            q = p.crop((0, 0, min(p.width, x1 - x), p.height))
            im.alpha_composite(q, (x, y - q.height))
    for key, x, y in pieces:
        p = art(key)
        im.alpha_composite(p, (x, y - p.height))
    return Image


# The touch buttons as the README's touch controls place them: (sprite, centre).
BUTTONS = (("ui-touch-use", (592, 210)), ("ui-touch-jump", (667, 307)))


def touch_buttons(im, tops):
    """Draw the Use and Jump buttons' rest frame on each screen whose top is in tops, for checking the HUD zones."""

    for key, (cx, cy) in BUTTONS:
        with Path(f"{SPRITES}/{key}.json").open() as f:
            fr = next(iter(json.load(f)["frames"].values()))["frame"]
        b = Image.open(f"{SPRITES}/{key}.png").convert("RGBA").crop((0, 0, fr["w"], fr["h"]))
        for top in tops:
            im.alpha_composite(b, (cx - (fr["w"] - 1) // 2, top + cy - (fr["h"] - 1) // 2))


def street_example(chars=True, hud=True):

    entries = STREET_EXAMPLE
    tiles = {name: frame_image(g.px) for name, g in street_tiles_cool()[0]}
    im = Image.new("RGBA", (720, 720), (*rgb("ink"), 255))
    compose(im, BACKDROP_DEFS, entries["runs"], entries["pieces"])
    ground = STREET_FY // T
    for r in range(ground, 60):
        for c in range(60):
            name = ("sidewalk-top-joint" if c % 2 else "sidewalk-top") if r == ground else "sidewalk-face"
            im.alpha_composite(tiles[name], (c * T, r * T))
    c0, w = entries["planter"]
    for r, part in ((ground - 2, "top"), (ground - 1, "")):
        for c in range(c0, c0 + w):
            side = "-left" if c == c0 else "-right" if c == c0 + w - 1 else ""
            name = f"planter-{part}{side}" if part else f"planter{side}"
            im.alpha_composite(tiles[name.replace("planter-top", "planter-top")], (c * T, r * T))
    for kind, row, c0, w in entries["ledges"]:
        for c in range(c0, c0 + w):
            side = "-left" if c == c0 else "-right" if c == c0 + w - 1 else ""
            im.alpha_composite(tiles[f"one-way-{kind}{side}"], (c * T, row * T))
    if chars:
        bird = Image.open(f"{SPRITES}/bird.png").convert("RGBA").crop((0, 0, 48, 42))
        im.alpha_composite(bird, (150 - 24, 28 * T - 42))
    if hud:
        touch_buttons(im, (0, 360))
    return im.convert("RGB")


# One example lobby for the preview only, 720x720 (60x60 tiles, two screens tall), built to the reaches: a hop
# rises 3 tiles, a full jump 8, a flutter crosses a gap of 20. One-way rows: (style, row, first col, width).
LOBBY_EXAMPLE = {
    "ledges": [
        ("cushion", 53, 15, 8),
        ("cushion", 50, 15, 8),
        ("desk", 48, 26, 10),
        ("shelf", 48, 40, 7),
        ("shelf", 40, 40, 7),
        ("shelf", 32, 40, 7),
        ("shelf", 24, 40, 7),
        ("balcony", 24, 0, 20),
    ],
    "exit": (4, 9),
    "post": 58,
    "runs": [("lobby-wall", 0, 720), ("lobby-balustrade", 0, 240)],
    "pieces": [
        ("lobby-front-door", 12),
        ("lobby-sofa", 168),
        ("lobby-desk", 312),
        ("lobby-bookcase", 480),
        ("lobby-window", 576),
        ("lobby-plant", 640),
        ("lobby-lamp", 288),
        ("lobby-lamp", 384),
    ],
    "ys": {"lobby-balustrade": 288},
}


def lobby_example(chars=True, hud=True):

    entries = LOBBY_EXAMPLE
    tiles = {name: frame_image(g.px) for name, g in lobby_tiles()[0]}
    pieces = {k: frame_image(fn().px) for k, (fn, _, _) in BACKDROP_DEFS.items() if k.startswith("lobby-")}
    ys = {k: entries["ys"].get(k, y) for k, (_, y, _) in BACKDROP_DEFS.items()}
    im = Image.new("RGBA", (720, LOBBY_H), (*rgb("ink"), 255))
    for key, x0, x1 in entries["runs"]:
        p = pieces[key]
        for x in range(x0, x1, p.width):
            q = p.crop((0, 0, min(p.width, x1 - x), p.height))
            im.alpha_composite(q, (x, ys[key] - q.height))
    for key, x in entries["pieces"]:
        p = pieces[key]
        im.alpha_composite(p, (x, ys[key] - p.height))
    ground = LOBBY_FY // T
    for r in range(ground, LOBBY_H // T):
        for c in range(60):
            im.alpha_composite(
                tiles["floor-top-joint" if c % 2 else "floor-top"] if r == ground else tiles["floor-face"],
                (c * T, r * T),
            )
    for style, row, c0, w in entries["ledges"]:
        for c in range(c0, c0 + w):
            k = "-left" if c == c0 else "-right" if c == c0 + w - 1 else ""
            im.alpha_composite(tiles[f"one-way-{style}{k}"], (c * T, row * T))
    pc = entries["post"]
    for r in range(ground):
        for c, side in ((pc, "left"), (pc + 1, "right")):
            im.alpha_composite(tiles[f"post-{'base-' if r == ground - 1 else ''}{side}"], (c * T, r * T))
    ec, er = entries["exit"]
    for j in range(15):
        for i in range(7):
            im.alpha_composite(tiles[f"exit-{j * 7 + i}"], ((ec + i) * T, (er + j) * T))
    if chars:
        bird = Image.open(f"{SPRITES}/bird.png").convert("RGBA").crop((0, 0, 48, 42))
        im.alpha_composite(bird, (150 - 24, LOBBY_FY - 42))
    if hud:
        touch_buttons(im, (0, 360))
    return im.convert("RGB")


def preview(out):

    strip = street_example()
    sheets = []
    for _, fn in TILESET_DEFS:
        tiles, _ = fn()
        ts = tileset_image(tiles)
        bg = Image.new("RGBA", ts.size, (*rgb("dslate"), 255))
        bg.alpha_composite(ts)
        sheets.append(bg.convert("RGB").resize((ts.width * 4, ts.height * 4), Image.NEAREST))
    lobby = lobby_example()
    gap = 16
    x0 = strip.width + gap + lobby.width + gap
    sheet = Image.new(
        "RGB", (x0 + max(s.width for s in sheets), max(strip.height, sum(s.height + gap for s in sheets))), rgb("ink")
    )
    sheet.paste(strip, (0, 0))
    sheet.paste(lobby, (strip.width + gap, 0))
    y = 0
    for s in sheets:
        sheet.paste(s, (x0, y))
        y += s.height + gap
    sheet.save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
