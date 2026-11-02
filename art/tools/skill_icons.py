"""Native skill glyphs, authored independently of HUD placement and room presentation.

Usage: skill_icons.py build | preview OUT.png, from the repository root.
Double-jump, dash and speedy use transparent 16x16 glyphs with two-pixel strokes.
Both have ready (frame0,100ms,cream) and muted (frame1,100ms,grey) tags, one static frame per tag.
Tags loop and have identical alpha geometry; there is no contact box, nine-slice or third state.
The source layers these glyphs over the reused navy UI disc and supplies the 48px touch target.
Unlocked skills remain visible, and muted icons still open informational details. Gameplay owns readiness.
No HUD coordinates, skill behaviour, input binding, modal or room-card chrome is baked into these glyphs.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel

SRC = "art/ui"
KEYS = ("icon-skill-double-jump", "icon-skill-dash", "icon-skill-speedy")
ONCE = dict.fromkeys(KEYS, ())
STATES = (("ready", "cream"), ("muted", "grey"))


def glyph(colour, skill):
    g = pixel.Grid(16, 16)
    if skill == "double-jump":
        for top in (2, 9):
            g.rect(7, top, 2, 2, colour)
            for step in range(1, 5):
                g.rect(7 - step, top + step, 2, 2, colour)
                g.rect(7 + step, top + step, 2, 2, colour)
    elif skill == "speedy":
        g.rect(9, 2, 3, 4, colour)
        g.rect(8, 5, 3, 4, colour)
        g.rect(7, 8, 3, 3, colour)
        g.rect(9, 9, 4, 3, colour)
        g.rect(12, 10, 3, 2, colour)
        g.rect(6, 11, 9, 2, colour)
        g.rect(1, 3, 5, 2, colour)
        g.rect(0, 7, 5, 2, colour)
    else:
        for x, y, width in ((2, 3, 6), (0, 7, 11), (3, 11, 5)):
            g.rect(x, y, width, 2, colour)
        for step in range(5):
            g.rect(9 + step, 3 + step, 2, 2, colour)
            g.rect(9 + step, 11 - step, 2, 2, colour)
    return g.px


def sprites():
    for skill in ("double-jump", "dash", "speedy"):
        yield "icon-skill-" + skill, [(state, [glyph(colour, skill)], 100) for state, colour in STATES]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(pixel.K["navy"],), once=ONCE)
