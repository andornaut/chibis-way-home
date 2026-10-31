#!/usr/bin/env python3
"""Cute owl antagonist, 48x48, bottom-centre anchor24,48. No portrait, dialogue or species physics.

Frustration: four120ms looping headshake and raised wing/paw poses, fixed feet, no world displacement.

Usage: owl.py build | preview OUT.png, from repository root. Every pose uses hitbox2,2,44,46, including
mirrors. Idle2x400ms, prepare2x160ms, drop2x100ms, return4x120ms, rest2x400ms; all loop, once[].
Prepare lowers the head; drop spreads wings for the swoop; return alternates wingbeats; rest settles.
All states retain the ordinary lethal-contact runtime meaning. No red outline or state paint.
Grey/cream face discs, quiet brown breast and dark rounded wings distinguish the owl from the duck.
Flight wings remain inside the same48px footprint. Sprite state motion does not alter the collision box.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
from pixel import Grid, K  # noqa: E402

SRC = "art/antagonists"
KEY = "owl-antagonist"
ONCE = {KEY: []}
HITBOX = {KEY: (2, 2, 44, 46)}


def draw(state="idle", phase=0):
    g = Grid(48, 48)
    flying = state in ("drop", "return")
    lift = 2 + phase % 2 if flying else phase if state in ("idle", "rest") else -1 - phase
    if state == "frustration":
        lift = 0
    if flying:
        up = state == "return" and phase % 2 == 0
        for x in (9, 39):
            g.ell(x, 20 if up else 32, 5, 13 if up else 8, "grey", sh="slate", li="lgrey")
    g.blob(24, 34 - lift, 11, 11, "zone-peach-shade", sh="brown", li="grey")
    g.ell(24, 36 - lift, 7, 8, "cream", sh="zone-peach")
    if not flying:
        for x in (15, 33):
            g.ell(x, (24 if phase % 2 == 0 else 31) if state == "frustration" else 33 - lift,
                  5 if state == "frustration" else 4, 9, "grey", sh="slate", li="lgrey")
    hx = (-2, 1, 2, -1)[phase] if state == "frustration" else 0
    hy = 18 - lift
    g.blob(24 + hx, hy, 14, 12, "grey", sh="slate", li="lgrey")
    for x in (18, 30):
        x += hx
        g.ell(x, hy + 1, 6.5, 8, "cream", sh="zone-peach")
        x += hx
        g.ell(x, hy + 1, 3, 4, "ink")
        g.rect(x - 1, hy - 1, 2, 2, "white")
    g.tri((21 + hx, hy + 5), (27 + hx, hy + 5), (24 + hx, hy + 10), "brown")
    # Feet stay visible without suggesting a perch or a standable wing edge.
    for x in (19, 28):
        g.rect(x, 44 if not flying else 42, 3, 3, "brown")
    return g.outlined(lambda c: K["navy"])


def sprites():
    yield KEY, [(state, [draw(state, i) for i in range(count)], ms)
                for state, count, ms in (("idle", 2, 400), ("prepare", 2, 160), ("drop", 2, 100),
                                         ("return", 4, 120), ("rest", 2, 400), ("frustration", 4, 120))]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(K["zone-green"], K["slate"], K["cream"]),
               once=ONCE, hitboxes=HITBOX)
