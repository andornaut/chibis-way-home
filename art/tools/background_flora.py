"""Small naturalistic decorative reeds,24x24, bottom-centre12,24. No collision or interaction.

Usage: background_flora.py build | preview OUT.png, from repository root.
background-reeds: sway4x300ms LOOP once[]. Lanceolate leaves and narrow seedheads bend with the wind;
roots stay planted. No world translation, bright points of interest or hazard colours.
Gameplay owns placement/timing. Use the existing scenery animation and parallax contracts; do not float
rooted flora independently of its supporting ground plane. Sprite bounds0,0,24,24, no hitbox/contact mask.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from pixel import Grid, K

SRC = "art/scenery"
KEY = "background-reeds"
ONCE = {KEY: []}


def draw(phase):
    g = Grid(24, 24)
    bend = (-1, 0, 1, 0)[phase]
    for root, tip, top in ((10, 8, 5), (13, 14, 2), (16, 19, 8)):
        for y in range(top, 24):
            x = root + (tip + bend - root) * (24 - y) / (24 - top)
            g.rect(int(x), y, 2, 1, "zone-green-shade")
        g.rect(tip + bend, top, 2, 4, "zone-peach-shade")
    for tip, join in (((2 + bend, 10), (11, 22)), ((21 + bend, 12), (15, 23)), ((4 + bend, 17), (13, 24))):
        x, y = tip
        ex, ey = join
        g.tri((x, y), (ex - 1, ey), ((x + ex) / 2, (y + ey) / 2 - 2), "zone-green-shade")
        g.tri((x, y), (ex + 1, ey), ((x + ex) / 2 + 2, (y + ey) / 2), "zone-green")
    return g.px


def sprites():
    yield KEY, [("sway", [draw(i) for i in range(4)], 300)]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(K["zone-green"], K["forest"]), once=ONCE)
