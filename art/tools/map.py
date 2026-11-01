"""Cool pastel route-map assets, with six themed destinations and standard modal controls.

Usage, from the repository root:
  python3 -I art/tools/map.py build            write Aseprite sources, PNG/JSON and manifest entries
  python3 -I art/tools/map.py preview OUT.png  contact sheet on pale steel, cream and slate

The map uses a 720x360 view and six 35x35 zone markers, centred on the 12px grid:
Blue cityscape (126,90), Industrial outskirts (354,90), Countryside (582,90), Woodland (582,222),
Home city (354,222), Apartment (126,222). The route follows that order without forks.

map-paper is a 32x32 nine-slice, margins 13,13,13,13, with a pale steel lgrey face and grey/slate rules.
Meaningful marks use dslate, navy or slate. Selection never uses lethal red.
map-zone keeps its existing tags and frame positions: normal cream disc with a dslate ring; current adds
an outer dslate ring; visited is navy with a cream tick badge; locked replaces the icon with a dslate
padlock; unbuilt is a broken slate ring and question mark. Shape carries each state as well as colour.

map-icon-<destination> is 14x14, centred over normal/current/visited nodes. Both tags use a muted primary backing, an
ink landmark and a dslate edge; the visited marker supplies its completion tick. Locked/unbuilt nodes show no
icon. The street and generic zone icons remain available. map-region-<destination> is a 120x60 static illustration
placed at cx-60,
cy-36, behind paths and markers. These decorative buildings, fields and trees keep destination identity
visible while its marker is locked or unbuilt. No region depicts a playable layout.

Paths and labels are runtime drawings. Open paths are 4px solid dslate; built, locked paths are 2px slate
dashes (6 on, 4 off); unbuilt paths are 2x2 slate dots every 6px. Zone names use font-title at 2x, ink,
with at most 212px of visible ink, centred under their markers. Visible capitals occupy cy+20..29, with an
lgrey knock-out behind.
Back to title is ui-button at164,300,192,48; Continue is ui-button-primary at364,300,192,48.

map-bird remains 26x22 with idle2x400ms, centred on the current node and standing on its top ring.
Legacy map-fork and pen marks remain available but the six-zone V1 route needs no fork markers.

The stage picker reuses the content-fitted ui-settings-card, with a zone heading and standard 24x24
close X included in the measured content union. Add 16px outer padding on all four sides. Its two
48px stage buttons use equal widths derived from their actual labels and the shared control padding.
The latest available stage uses ui-button-primary with white text; the other uses ui-button with ink.
It opens only when more than one stage is unlocked. Close, back and outside taps return to the map.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
import zone_themes
from pixel import Grid

SRC = "art/map"


def bm(*rows):
    """A bitmap from strings: '#' is set."""
    return [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "#"]


def stamp(g, pts, x, y, c):
    for px, py in pts:
        g.p(x + px, y + py, c)


def disc(g, cx, cy, r, c):
    """A filled disc on a centre pixel, 2r+1 across."""
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            if x * x + y * y <= r * r + r * 0.6:
                g.p(cx + x, cy + y, c)


def ring(g, cx, cy, r, w, c, broken=False):
    """A ring w px thick whose outer edge is radius r; broken leaves eight gaps, one every 45 degrees."""
    for y in range(-r - 1, r + 2):
        for x in range(-r - 1, r + 2):
            if r - w + 0.5 < math.hypot(x, y) <= r + 0.5:
                if broken and (math.degrees(math.atan2(y, x)) + 360) % 45 > 30:
                    continue
                g.p(cx + x, cy + y, c)


def diamond(g, cx, cy, r, c):
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            if abs(x) + abs(y) <= r:
                g.p(cx + x, cy + y, c)


# ---------------------------------------------------------------- paper


def paper():
    """32x32 nine-slice: pale steel, a 2px slate rule 6px in and a 2px grey rule 11px in."""
    g = Grid(32, 32)
    g.rect(0, 0, 32, 32, "lgrey")
    for inset, c in ((6, "slate"), (11, "grey")):
        n = 32 - 2 * inset
        g.rect(inset, inset, n, 2, c)
        g.rect(inset, 32 - inset - 2, n, 2, c)
        g.rect(inset, inset, 2, n, c)
        g.rect(32 - inset - 2, inset, 2, n, c)
    g.rect(13, 13, 6, 6, "lgrey")
    return g.px


def hill():
    """20x11: a hill's outline, a 2px stroke stepping 2px per 2px."""
    g = Grid(20, 11)
    for i in range(10):
        g.rect(i * 2, int(abs(i - 4.5) * 2), 2, 2, "tan")
    return g.px


def wave():
    """22x4: three 2px humps."""
    g = Grid(22, 4)
    for i, dy in enumerate((2, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0)):
        g.rect(i * 2, dy, 2, 2, "tan")
    return g.px


def compass():
    """25x33: an N over a four-point star, arms tapering from 3px to 1px."""
    g = Grid(25, 33)
    stamp(g, bm("##..##", "###.##", "######", "##.###", "##..##"), 9, 0, "tan")
    cx, cy = 12, 20
    for k in range(13):
        w = 3 if k < 4 else 2 if k < 9 else 1
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            x, y = cx + dx * k, cy + dy * k
            if dx == 0:
                g.rect(x - w // 2, y, w, 1, "tan")
            else:
                g.rect(x, y - w // 2, 1, w, "tan")
    diamond(g, cx, cy, 3, "tan")
    return g.px


# ---------------------------------------------------------------- icons, 14x14, 2px strokes

ICONS = {
    "street": (
        "##############",
        "##############",
        "##..........##",
        "##..##..##..##",
        "##..##..##..##",
        "##..........##",
        "##..##..##..##",
        "##..##..##..##",
        "##..........##",
        "##...####...##",
        "##...####...##",
        "##...####...##",
        "##############",
        "##############",
    ),
    # a map pin: a ring on a point
    "zone": (
        "....######....",
        "...########...",
        "..###....###..",
        "..##......##..",
        "..##......##..",
        "..##......##..",
        "..###....###..",
        "...########...",
        "....######....",
        ".....####.....",
        ".....####.....",
        "......##......",
        "......##......",
        "..............",
    ),
}
# Small landmarks use thick clusters and a different silhouette for each destination.
ICONS.update(
    {
        "apartment": (
            "..##########..",
            "..##########..",
            "..##..##..##..",
            "..##..##..##..",
            "..##########..",
            "..##..##..##..",
            "..##..##..##..",
            "..##########..",
            "..##..##..##..",
            "..##..##..##..",
            "..##########..",
            "..###....###..",
            "..###....###..",
            "..##########..",
        ),
        "blue-cityscape": (
            "......####....",
            "......####....",
            "..####.##.####",
            "..####.##.####",
            "..##...##...##",
            "..##...##...##",
            "..####.##.####",
            "..####.##.####",
            "..##...##...##",
            "..##...##...##",
            "..####.##.####",
            "..####.##.####",
            "..############",
            "..############",
        ),
        "countryside": (
            "......##......",
            "....######....",
            "..##########..",
            "##############",
            "##..........##",
            "##...####...##",
            "##...####...##",
            "##...####...##",
            "##############",
            "..............",
            "##############",
            "##############",
            "..##########..",
            "....######....",
        ),
        "home-city": (
            "...##.........",
            "...##.##......",
            "....######....",
            "...########...",
            "..##########..",
            ".############.",
            "##..........##",
            "##..##..##..##",
            "##..##..##..##",
            "##..........##",
            "##...####...##",
            "##...####...##",
            "##############",
            "##############",
        ),
        "industrial": (
            "..##..........",
            "..##..........",
            "..##..##..##..",
            "..##.###.###..",
            "..##########..",
            "..##########..",
            "..##..##..##..",
            "..##..##..##..",
            "..##########..",
            "..##########..",
            "..###....###..",
            "..###....###..",
            "..##########..",
            "..##########..",
        ),
        "woodland": (
            "...##....##...",
            "..####..####..",
            ".############.",
            "##############",
            "..####..####..",
            ".############.",
            "##############",
            "##############",
            "...##....##...",
            "...##....##...",
            "...##....##...",
            "...##....##...",
            "..####..####..",
            "..####..####..",
        ),
    }
)


def outlined_block(g, colour, box):
    x, y, w, h = box
    g.rect(x, y, w, h, "dslate")
    g.rect(x + 1, y + 1, w - 2, h - 2, colour)


def region(kind):
    """120x60 theme fragments, predominantly the destination's muted primary, with a clear marker opening."""
    g = Grid(120, 60)
    primary = zone_themes.THEMES[kind]["primary"]
    shade = primary + "-shade"
    if kind in ("blue-cityscape", "home-city", "apartment", "industrial"):
        if kind == "industrial":
            for x in (2, 86):
                outlined_block(g, primary, (x + 4, 10, 7, 26))
                g.tri((x, 34), (x + 18, 22), (x + 34, 34), "dslate")
                g.tri((x + 2, 34), (x + 18, 24), (x + 32, 34), primary)
                outlined_block(g, primary, (x, 34, 32, 24))
                g.rect(x + 2, 50, 28, 6, shade)
                g.rect(x + 8, 40, 4, 4, "dslate")
                g.rect(x + 20, 40, 4, 4, "dslate")
        elif kind == "home-city":
            for x in (2, 86):
                g.tri((x, 30), (x + 16, 18), (x + 32, 30), "dslate")
                g.tri((x + 3, 29), (x + 16, 20), (x + 29, 29), shade)
                outlined_block(g, primary, (x + 3, 30, 26, 28))
                g.rect(x + 6, 48, 20, 2, shade)
                g.rect(x + 8, 36, 4, 6, "dslate")
                g.rect(x + 20, 36, 4, 6, "dslate")
        elif kind == "apartment":
            for x in (6, 94):
                outlined_block(g, primary, (x, 8, 20, 50))
                for y in (16, 28, 40):
                    g.rect(x + 4, y, 4, 4, "dslate")
                    g.rect(x + 12, y, 4, 4, "dslate")
                g.rect(x + 8, 50, 6, 7, shade)
        else:
            for x, w, top in ((2, 20, 20), (22, 14, 6), (86, 16, 14), (102, 16, 28)):
                outlined_block(g, primary, (x, top, w, 58 - top))
                g.rect(x + 2, 50, w - 4, 6, shade)
    elif kind == "countryside":
        for x in (0, 82):
            g.tri((x, 44), (x + 18, 34), (x + 37, 44), "dslate")
            g.tri((x + 2, 44), (x + 18, 36), (x + 35, 44), primary)
            outlined_block(g, primary, (x, 44, 38, 14))
            g.rect(x + 4, 48, 29, 2, shade)
            g.rect(x + 10, 54, 26, 2, shade)
    elif kind == "woodland":
        for x, y in ((12, 34), (28, 42), (92, 38), (108, 30)):
            g.rect(x - 2, y + 2, 4, 20, "dslate")
            g.tri((x, y - 22), (x - 12, y + 6), (x + 12, y + 6), "dslate")
            g.tri((x, y - 19), (x - 10, y + 5), (x + 10, y + 5), primary)
            g.tri((x, y - 14), (x - 12, y + 14), (x + 12, y + 14), "dslate")
            g.tri((x, y - 11), (x - 10, y + 13), (x + 10, y + 13), primary)
            g.rect(x - 6, y + 10, 12, 2, shade)
    return g.px


QMARK = bm("..####..", ".##..##.", ".....##.", "....##..", "...##...", "...##...", "........", "...##...", "...##...")
TICK = bm("....##", "...##.", "##.##.", ".###..", "..#...")
LOCK = bm(
    "...####...",
    "..######..",
    ".##....##.",
    ".##....##.",
    ".##....##.",
    "##########",
    "##########",
    "####..####",
    "####..####",
    "#####.####",
    "##########",
    "##########",
)


def icon(c, primary, rows):
    g = Grid(14, 14)
    if primary:
        # A muted primary backing keeps its colour visible between the dark landmark's bold strokes.
        g.rect(0, 0, 14, 14, "dslate")
        g.rect(1, 1, 12, 12, primary)
        stamp(g, bm(*rows), 0, 0, "ink")
    else:
        stamp(g, bm(*rows), 0, 0, c)
    return g.px


# ---------------------------------------------------------------- markers


def zone(state):
    g = Grid(35, 35)
    c = 17
    if state == "unbuilt":
        disc(g, c, c, 12, "cream")
        ring(g, c, c, 12, 2, "slate", broken=True)
        stamp(g, QMARK, c - 4, c - 4, "slate")
        return g.px
    if state == "current":
        ring(g, c, c, 17, 2, "dslate")
    if state == "visited":
        disc(g, c, c, 12, "navy")
        disc(g, 27, 26, 6, "cream")
        ring(g, 27, 26, 6, 2, "dslate")
        stamp(g, TICK, 24, 24, "dslate")
        return g.px
    disc(g, c, c, 12, "cream")
    ring(g, c, c, 12, 2, "dslate")
    if state == "locked":
        stamp(g, LOCK, c - 5, c - 6, "dslate")
    return g.px


def fork(state):
    g = Grid(29, 29)
    c = 14
    if state == "unbuilt":
        for dx, dy in ((0, -7), (0, 7), (-7, 0), (7, 0)):
            diamond(g, c + dx, c + dy, 2, "slate")
        return g.px
    if state == "current":
        ring(g, c, c, 14, 2, "dslate")
    diamond(g, c, c, 8, "navy")
    if state != "visited":
        diamond(g, c, c, 5, "cream")
    return g.px


def bird(frame):
    """26x22, facing right; frame 1 lifts everything but the feet 1px."""
    up = frame
    g = Grid(26, 22)
    g.ell(10.5, 13.5 - up, 9.5, 6.5, "cream", sh="tan", li="white")
    g.tri((1.5, 9 - up), (6, 10 - up), (3, 13 - up), "cream")
    g.ell(16.5, 6.5 - up, 5, 5, "cream", li="white")
    g.rect(21, 6 - up, 3, 3, "orange")
    g.rect(17, 5 - up, 2, 2, "ink")
    g.ell(8.5, 12.5 - up, 5, 2, "tan")
    g.rect(7, 20, 3, 1, "orange")
    g.rect(12, 20, 3, 1, "orange")
    return g.outlined(edge=lambda _c: pixel.K["dslate"])


# ---------------------------------------------------------------- the set

SLICES = {"map-paper": (13, 13, 13, 13)}
ONCE = {}


def sprites():
    one = lambda frame, tag="rest": [(tag, [frame], 100)]  # noqa: E731
    yield "map-compass", one(compass())
    yield "map-bird", [("idle", [bird(0), bird(1)], 400)]
    yield "map-fork", [(s, [fork(s)], 100) for s in ("normal", "current", "visited", "unbuilt")]
    yield "map-hill", one(hill())
    for key in sorted(ICONS):
        primary = zone_themes.THEMES[key]["primary"] if key in zone_themes.THEMES else None
        yield (
            f"map-icon-{key}",
            [
                ("normal", [icon("dslate", primary, ICONS[key])], 100),
                ("visited", [icon("cream", primary, ICONS[key])], 100),
            ],
        )
    yield "map-paper", one(paper())
    for key in sorted(zone_themes.THEMES):
        yield f"map-region-{key}", one(region(key))
    yield "map-wave", one(wave())
    yield "map-zone", [(s, [zone(s)], 100) for s in ("normal", "current", "visited", "locked", "unbuilt")]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=("c0cbdc", "ead4aa", "5a6988"), slices=SLICES, once=ONCE)
