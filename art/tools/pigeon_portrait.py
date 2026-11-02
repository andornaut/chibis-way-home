"""Pebble's64x64 dialogue portrait, matching the grey/lilac/cream pigeon encounter sprite.

Usage: pigeon_portrait.py build | preview OUT.png, from the repository root.
One right-facing neutral frame,1000ms loop, once[]. Transparent ground, ink outline, no hitbox/contact.
The head and upper chest fill the existing64x64 portrait slot; the chest crops at the bottom edge.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from pixel import Grid, K

KEY = "portrait-pigeon"
SRC = "art/antagonists"


def portrait():
    g = Grid(64, 64)
    g.blob(26, 65, 25, 25, "grey", sh="slate", li="lgrey")
    g.ell(41, 64, 14, 25, "cream", sh="zone-peach")
    g.ell(28, 43, 14, 17, "zone-purple-shade")
    g.blob(15, 61, 14, 12, "slate", li="grey")
    g.blob(35, 25, 18, 17, "grey", sh="slate", li="lgrey")
    g.tri((50, 29), (60, 33), (50, 36), "brown")
    g.rect(43, 20, 5, 5, "ink")
    g.rect(43, 20, 2, 2, "white")
    return g.outlined(lambda _colour: K["ink"])


def sprites():
    yield KEY, [("neutral", [portrait()], 1000)]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(K["dslate"], K["lgrey"]))
