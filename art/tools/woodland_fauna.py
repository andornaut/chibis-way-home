"""Naturalistic decorative woodland fauna. No actors, collision, dialogue, plot or interaction.

Usage: woodland_fauna.py build | preview OUT.png, from repository root.
background-deer32x24, bottom-centre16,24: idle2x900ms and graze4x300ms, all loop once[]. Adult body,
small head, slender neck and tapered planted legs with fixed hoof patches. Muted coat, no clothes or
exaggerated eyes.
background-swallow144x96, centre72,48: flight4x120ms loop once[]. Flat zone-fauna silhouette with
pointed swept wings, a long forked tail and a small head and streamlined body. Animation contains pose
changes only; gameplay owns placement and movement. Native dimensions also define viewport intersection.
Neither sprite declares a hitbox or contact mask. Tech owns decorative background depth and parallax.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from PIL import Image, ImageDraw
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
    """Native swept-wing silhouette, keeping the head, torso and forked tail stable in flight."""
    wings = (
        ((88, 46), (99, 41), (89, 31), (72, 19), (48, 8), (30, 2), (44, 18), (56, 32), (69, 43), (78, 49)),
        ((88, 47), (100, 41), (86, 34), (69, 26), (42, 15), (15, 11), (32, 23), (49, 35), (69, 46), (78, 50)),
        ((88, 44), (100, 48), (98, 60), (78, 79), (35, 91), (54, 73), (66, 57), (76, 46)),
        ((88, 47), (101, 42), (87, 30), (64, 17), (32, 10), (48, 27), (62, 41), (72, 48)),
    )
    far_wings = (
        ((90, 42), (96, 27), (84, 10), (71, 8), (75, 28), (75, 43)),
        ((92, 43), (93, 31), (79, 24), (51, 30), (73, 41)),
        ((90, 48), (94, 60), (81, 75), (62, 79), (69, 62), (74, 49)),
        ((91, 43), (96, 30), (80, 16), (65, 18), (73, 34), (77, 43)),
    )
    mask = Image.new("1", (144, 96))
    draw = ImageDraw.Draw(mask)
    draw.polygon(far_wings[phase], fill=1)
    draw.polygon(((8, 30), (58, 41), (67, 47), (50, 50), (22, 43)), fill=1)
    draw.polygon(((8, 67), (60, 54), (67, 47), (51, 47), (22, 55)), fill=1)
    draw.ellipse((54, 40, 119, 57), fill=1)
    draw.ellipse((111, 34, 129, 49), fill=1)
    draw.polygon(((126, 38), (138, 41), (128, 44)), fill=1)
    draw.polygon(wings[phase], fill=1)
    colour = K["bg-woodland-fauna"]
    return [[colour if mask.getpixel((x, y)) else None for x in range(144)] for y in range(96)]


def sprites():
    yield (
        "background-deer",
        [("idle", [deer(phase=i) for i in range(2)], 900), ("graze", [deer("graze", i) for i in range(4)], 300)],
    )
    yield "background-swallow", [("flight", [swallow(i) for i in range(4)], 120)]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(K["zone-green"], K["forest"]), once=ONCE)
