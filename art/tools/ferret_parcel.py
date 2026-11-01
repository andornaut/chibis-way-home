"""Furt's active thrown parcel:24x24 canvas, bottom-centre12,24, visible16x16 at hitbox4,8,16,16.

Usage: ferret_parcel.py build | preview OUT.png, from repository root.
Tag idle1x400ms LOOP once[]. Ink1px outside edge encloses a canonical red2px danger band, then simple
brown cardboard and cream tape. No spikes, text or new mechanics. Runtime owns arc, spawn and lifetime;
no travel is baked into the single frame. This active projectile differs from nonlethal opening parcels.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from pixel import Grid, K

KEY = "ferret-parcel"
SRC = "art/antagonists"
ONCE = {KEY: []}
HITBOX = {KEY: (4, 8, 16, 16)}


def draw():
    g = Grid(16, 16)
    g.rect(0, 0, 16, 16, "ink")
    g.rect(1, 1, 14, 14, "red")
    g.rect(3, 3, 10, 10, "brown")
    g.rect(3, 3, 10, 2, "zone-peach")
    g.rect(7, 3, 2, 10, "cream")
    g.rect(3, 8, 10, 2, "cream")
    padded = Grid(24, 24)
    for y, row in enumerate(g.px):
        for x, colour in enumerate(row):
            if colour:
                padded.p(x + 4, y + 8, colour)
    return padded.px


def sprites():
    yield KEY, [("idle", [draw()], 400)]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(K["zone-red"], K["slate"]), once=ONCE, hitboxes=HITBOX)
