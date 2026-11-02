"""Naturalistic decorative woodland fauna. No actors, collision, dialogue, plot or interaction.

Usage: woodland_fauna.py build | preview OUT.png, from repository root.
background-deer32x24, bottom-centre16,24: idle2x900ms and graze4x300ms, all loop once[]. Adult body,
small head, slender neck and tapered planted legs with fixed hoof patches. Muted coat, no clothes or
exaggerated eyes.
background-swallow24x12, centre12,6: flight4x120ms loop once[]. Pointed swept wings and forked tail,
small streamlined body. Animation contains pose changes only; gameplay owns placement and movement.
Neither sprite declares a hitbox or contact mask. Tech owns decorative background depth and parallax.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from pixel import Grid, K

SRC = "art/scenery"
ONCE = {"background-deer": [], "background-swallow": []}


def deer(state="idle", phase=0):
    g = Grid(32, 24)
    for root, foot, far in ((9, 9, False), (12, 14, True), (20, 20, True), (23, 23, False)):
        colour = "plum" if far else "dbrown"
        if root < 16:
            g.tri((root - 1, 13), (root + 3, 16), (foot + 1, 19), colour)
            g.rect(foot, 18, 2, 2, colour)
        else:
            g.tri((root - 1, 13), (root + 2, 14), (foot + 1, 19), colour)
        g.rect(foot + 1, 18, 1, 5, colour)
        g.rect(foot, 22, 2, 2, colour)
    g.ell(15, 12, 9, 4, "dbrown")
    g.ell(14, 12, 7, 2, "zone-peach-shade")
    g.tri((7, 11), (3, 9), (4, 12), "dbrown")
    if state == "graze":
        hy = 17 + (0, 1, 2, 1)[phase]
        g.tri((21, 9), (28, hy - 2), (24, hy + 2), "dbrown")
        g.ell(27, hy, 4, 2, "dbrown")
        g.rect(29, hy, 2, 2, "plum")
        g.tri((25, hy - 1), (24, hy - 6), (27, hy - 3), "dbrown")
    else:
        g.tri((20, 13), (23, 4), (26, 9), "dbrown")
        g.ell(27, 5, 4, 2, "dbrown")
        g.rect(29, 5, 2, 2, "plum")
        g.rect(24 + phase, 0, 2, 5, "dbrown")
    return g.px


def swallow(phase):
    g = Grid(24, 12)
    g.rect(8, 5, 12, 3, "navy")
    g.rect(17, 4, 4, 3, "navy")
    g.rect(20, 5, 3, 1, "dslate")
    g.tri((9, 5), (1, 2), (5, 6), "navy")
    g.tri((9, 7), (1, 10), (5, 6), "navy")
    tip = ((8, 0), (5, 3), (12, 11), (7, 8))[phase]
    g.tri((10, 6), tip, (17, 6), "navy")
    g.tri((11, 5), (tip[0] + 4, max(0, min(11, tip[1] - 1))), (17, 6), "dslate")
    g.rect(13, 7, 5, 1, "slate")
    return g.px


def sprites():
    yield (
        "background-deer",
        [("idle", [deer(phase=i) for i in range(2)], 900), ("graze", [deer("graze", i) for i in range(4)], 300)],
    )
    yield "background-swallow", [("flight", [swallow(i) for i in range(4)], 120)]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(K["zone-green"], K["forest"]), once=ONCE)
