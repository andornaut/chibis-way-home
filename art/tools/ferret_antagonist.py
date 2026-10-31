#!/usr/bin/env python3
"""Compact apartment ferret encounter skin retaining the established champagne ferret identity.

Frustration: four120ms looping headshake and raised wing/paw poses, fixed feet, no world displacement.

Usage: ferret_antagonist.py build | preview OUT.png, from the repository root.
48x48 facing right, bottom centre (24,48), fixed hitbox (2,2,44,46), stable when mirrored.
Champagne and cream slender body, small wedge head, warm brown legs and tapering tail, plum stovepipe
with red band and red bow. Cute and sly, no teeth, red contact outline, dialogue or new story details.
Idle 2x400ms, walk 4x120ms, crouch 2x140ms, rush 4x80ms, rest 2x400ms. All loop.
Art cycles do not set gameplay state duration or bake world movement into the sprite anchor.
All states are lethal. The original 64x80 story ferret and its portraits remain separate and unchanged.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import duck  # noqa: E402
import ferret  # noqa: E402
import pixel  # noqa: E402
from pixel import Grid  # noqa: E402

KEY = "ferret-antagonist"
SRC = "art/antagonists"
ONCE = {KEY: []}
HITBOX = {KEY: (2, 2, 44, 46)}


def draw(state="idle", phase=0):
    g = Grid(48, 48)
    moving = state in ("walk", "rush")
    low = state in ("crouch", "rush")
    lift = phase % 2 if moving or state in ("idle", "rest") else 0
    hx, hy = (33, 27 - lift) if low else (29, 19 - lift)
    if state == "frustration":
        hx += (-2, 1, 2, -1)[phase]
    hip = (20, 36 - lift)
    # Tail and feet keep their ground reference as the slender spine bends forward.
    ferret.disc_line(g, (17, 38), (10, 44), 2, "brown")
    ferret.disc_line(g, (10, 44), (5, 46), 1, "brown")
    stride = (-2, 0, 2, 0)[phase] if moving else 0
    for x, delta, colour in ((19, stride, "dbrown"), (26, -stride, "brown")):
        ferret.disc_line(g, (x, 38 - lift), (x + delta, 44), 2, colour)
        g.rect(x + delta - 1, 44, 6, 3, colour)
    for i in range(11):
        t = i / 10
        x = hip[0] + (hx - 3 - hip[0]) * t - 3 * (1 - t) * t
        y = hip[1] + (hy + 4 - hip[1]) * t
        duck.cel(g, duck.in_ell(x, y, 6 - 2 * t, 6 - t), "skin1", "skin2", "cream", 1, 1)
    # Compact wedge, pale face band and soft lid preserve the recognisable expression.
    duck.cel(g, duck.in_ell(hx, hy, 6, 5), "skin1", "skin2", "cream", 1, 1)
    g.tri((hx, hy - 3), (hx + 10, hy + 2), (hx, hy + 4), "skin1")
    g.tri((hx, hy - 2), (hx + 9, hy + 2), (hx, hy + 2), "cream")
    g.ell(hx - 4, hy - 4, 2, 2, "skin2")
    g.rect(hx + 7, hy + 1, 2, 2, "pink")
    g.rect(hx + 1, hy - 1, 3, 3, "ink")
    g.p(hx + 1, hy - 1, "white")
    g.rect(hx + 1, hy - 2, 3, 1, "brown")
    # The hat stays upright, even during the lower committed rush.
    ferret.hat(g, hx - 1, hy - 4, 0.6)
    ferret.bow_tie(g, hx - 2, hy + 6, 0.55)
    paw_x = hx + 1 if low else hx - 4
    g.ell(paw_x, hy + 10, 2.5, 2, "brown")
    if state == "frustration":
        g.ell(hx + 5, hy + (7 if phase % 2 == 0 else 11), 3, 2.5, "brown")
    if state == "rest":
        g.rect(hx + 1, hy, 3, 1, "skin2")
    return ferret.outline(g)


def sprites():
    yield KEY, [("idle", [draw("idle", i) for i in range(2)], 400),
                ("walk", [draw("walk", i) for i in range(4)], 120),
                ("crouch", [draw("crouch", i) for i in range(2)], 140),
                ("rush", [draw("rush", i) for i in range(4)], 80),
                ("rest", [draw("rest", i) for i in range(2)], 400),
                ("frustration", [draw("frustration", i) for i in range(4)], 120)]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(pixel.K["zone-red"], pixel.K["slate"]),
               once=ONCE, hitboxes=HITBOX)
