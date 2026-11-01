"""Hazard sprites: the rolling traffic and the ferret's traps. The cellar hatch is tiles in tiles-street (floor1.py).

Usage, from the repository root:
  python3 -I art/tools/hazards.py build            write art/hazards/<key>.aseprite and
                                                   public/art/sprites/<key>.png + .json
  python3 -I art/tools/hazards.py preview OUT.png  contact sheet of every frame on slate, tan and cream

Every hazard takes an ink outline, so it holds 3:1 on every street ground, and is drawn at outdoor scale beside the
bird. A hazard restarts the floor on contact. Hit boxes are (x, y, width, height) in frame pixels for the facing
drawn, in HITBOX, and reach the manifest as "hitbox"; each box here is centred in its frame, so mirroring the sprite
does not move it.

frog-courier, 60x36: a frog courier on a delivery bike with a sky-blue cube bag on his back, facing right (the game
mirrors it for left). Rolls back and forth along the sidewalk. Tyres on row 34, outline on row 35 (the frame's bottom
row). Fills: green and dgreen (frog), sky, cyan and blue (bag), orange (frame), cream (eye), dslate and slate (wheel
disc and its turning bar, the slate ramp as steel; no grey). Hit box 6,6,48,30: the bike and the frog, leaving out
the top 6 rows (his eye bump and the bag's top) and 2px of each tyre's outer rim.

| Tag  | Frame | ms  | Pose                                                                      |
| ---- | ----- | --- | ------------------------------------------------------------------------- |
| ride | 0-3   | 100 | pedals 90 degrees per frame, the knees following; wheel bars 45 per frame |
| idle | 0     | 400 | ride frame 0, for when he waits                                           |

The wheel bar turns 45 degrees (5.1px of tyre) per frame, so at 100ms the wheels roll without slipping at 51 px/s.

frog-courier is a character. States: idle idle; move ride; react none, falls back to idle; talk none, falls back
to idle; quirk none.

ferret-trap-snap, 50x26: the ferret's giant spring mousetrap. A wooden board (tan top, brown face) with a red
trigger pedal, a plum-and-red spring at the hinge, a white steel bar and, standing on the front end, the ferret's
badge. Board on rows 19 to 24, outline on row 25. Hit box 4,14,42,12: the board and the pedal, not the cocked
bar's tip or the badge's top. No hold-down arm: a 1px diagonal wire turns uneven at fractional scales, and the
cocked bar alone reads as armed.

| Tag  | Frame | ms  | Pose                                                       |
| ---- | ----- | --- | ---------------------------------------------------------- |
| set  | 0     | 400 | armed: the bar cocked back over the hinge                  |
| snap | 0     | 60  | sprung: the bar swinging up past vertical                  |
| snap | 1     | 60  | the bar halfway down towards the pedal                     |
| snap | 2     | 80  | the bar slammed flat on the pedal, the badge jolted 1px up |
| snap | 3     | 80  | closed: the bar flat, the badge settled                    |

snap plays once and holds its last frame (ONCE); set is one frame, so a still trap reads as still. It is a hazard,
not a character, so it has no character states.

The badge (badge(), 13x13) is the ferret's calling card: a cream plate with his hat-and-bow mark (emblem(), 7x11:
a plum stovepipe with a red band over a red bow tie). Every trap the ferret sets carries it.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from pixel import Grid

SRC = "art/hazards"
INK = "ink"


def ink_outline(g):
    return g.outlined(lambda _c: pixel.K["ink"])


def stroke(g, x0, y0, x1, y1, c, w=1):
    """A line drawn with a square brush w px wide."""
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        g.rect(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), w, w, c)


# ---------------------------------------------------------------- the ferret's calling card


def emblem(g, x, y):
    """The ferret's hat-and-bow mark, 7x11 at x, y: a plum stovepipe (dark-brown rim light, red band, brim) over a
    red bow tie with a dark-red knot."""
    g.rect(x + 1, y, 5, 5, "plum")
    g.rect(x + 1, y, 1, 5, "dbrown")
    g.rect(x + 1, y + 4, 5, 1, "red")
    g.rect(x, y + 5, 7, 1, "plum")
    for xx in (0, 1, 5, 6):
        g.p(x + xx, y + 7, "red")
        g.p(x + xx, y + 9, "red")
    g.rect(x, y + 8, 7, 1, "red")
    g.p(x + 3, y + 8, "dred")


def badge(g, x, y):
    """The ferret's badge, 13x13 at x, y: a cream plate, lit along the top and shaded along the right and bottom,
    carrying his emblem. Every ferret trap carries it."""
    g.rect(x, y, 13, 13, "cream")
    g.rect(x, y, 13, 1, "white")
    g.rect(x + 12, y + 1, 1, 12, "tan")
    g.rect(x, y + 12, 13, 1, "tan")
    emblem(g, x + 3, y + 1)


# ---------------------------------------------------------------- frog courier


def wheel(g, cx, cy, r, f):
    """An ink tyre round a dslate disc, with a 2px slate bar through the hub turned 45 degrees per frame."""
    g.ell(cx, cy, r, r, "ink")
    g.ell(cx, cy, r - 2, r - 2, "dslate")
    a = math.radians(-45 * f)
    rr = r - 2.5
    x0, y0 = cx - 0.5 - rr * math.cos(a), cy - 0.5 - rr * math.sin(a)
    x1, y1 = cx - 0.5 + rr * math.cos(a), cy - 0.5 + rr * math.sin(a)
    for i in range(9):
        x, y = x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8
        g.p(round(x - 0.5), round(y - 0.5), "slate")
        g.p(round(x), round(y), "slate")


def knee(hip, foot, l1, l2):
    """The knee of a two-bone leg from hip to foot, bent forward."""
    (hx, hy), (fx, fy) = hip, foot
    d = min(math.hypot(fx - hx, fy - hy), l1 + l2 - 0.01)
    a = math.atan2(fy - hy, fx - hx)
    b = math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))
    return round(hx + l1 * math.cos(a - b)), round(hy + l1 * math.sin(a - b))


def frog_courier(f):
    g = Grid(60, 36)
    a = math.radians(90 * f)
    bb, hip = (27, 29), (24, 15)
    near = (bb[0] + round(4 * math.cos(a)), bb[1] + round(4 * math.sin(a)))
    far = (bb[0] - round(4 * math.cos(a)), bb[1] - round(4 * math.sin(a)))
    k = knee(hip, far, 9, 9)  # far leg, behind the frame
    stroke(g, *hip, *k, "dgreen", 3)
    stroke(g, *k, *far, "dgreen", 2)
    g.rect(far[0], far[1], 3, 2, "dgreen")
    wheel(g, 10.5, 28.5, 6.5, f)
    wheel(g, 49.5, 28.5, 6.5, f)
    for p0, p1 in (
        ((10, 28), bb),
        (bb, (22, 16)),
        ((22, 17), (42, 17)),
        ((42, 18), bb),
        ((22, 17), (10, 28)),
        ((42, 15), (49, 28)),
        ((42, 15), (43, 10)),
    ):
        stroke(g, *p0, *p1, "orange", 2)
    g.rect(40, 9, 6, 2, INK)  # handlebar
    g.rect(19, 15, 6, 2, INK)  # saddle
    # the cube bag on his back
    g.rect(8, 1, 13, 13, "sky")
    g.rect(8, 1, 13, 2, "cyan")
    g.rect(19, 3, 2, 11, "blue")
    g.rect(8, 7, 11, 2, "blue")
    g.blob(25, 12, 5.5, 5, "green", sh="dgreen")  # body
    k = knee(hip, near, 9, 9)  # near leg, in front of the frame
    stroke(g, *hip, *k, "green", 3)
    stroke(g, *k, *near, "green", 2)
    g.rect(near[0], near[1], 3, 2, "dgreen")
    # a wide frog head, bigger than the body, with an eye bump on top
    g.blob(35, 8, 7, 5.5, "green", sh="dgreen")
    g.ell(34.5, 3.5, 3.5, 3, "green")
    g.rect(33, 2, 3, 3, "cream")
    g.rect(34, 3, 2, 2, INK)
    g.rect(37, 10, 5, 1, "dgreen")  # mouth
    stroke(g, 29, 12, 41, 10, "green", 2)  # arm to the bar
    return ink_outline(g)


# ---------------------------------------------------------------- the snap trap

HINGE = (14, 17)
BAR = 18


def snap_trap(angle, jolt=0):
    """The trap with its bar at angle degrees (0 lies flat towards the front, counter-clockwise up)."""
    g = Grid(50, 26)
    g.rect(2, 19, 46, 2, "tan")
    g.rect(2, 21, 46, 3, "brown")
    g.rect(2, 24, 46, 1, "dbrown")
    g.rect(22, 17, 8, 2, "red")  # trigger pedal
    g.rect(22, 18, 8, 1, "dred")
    badge(g, 35, 6 - jolt)
    a = math.radians(angle)
    ex, ey = round(HINGE[0] + BAR * math.cos(a)), round(HINGE[1] - BAR * math.sin(a))
    stroke(g, *HINGE, ex, ey, "white", 2)
    for i, x in enumerate(range(10, 18, 2)):  # spring coil
        g.rect(x, 15, 2, 4, "red" if i % 2 else "plum")
    return ink_outline(g)


SNAP = [(100, 0), (50, 0), (0, 1), (0, 0)]  # (bar angle, badge jolt) per snap frame


def sprites():
    ride = [frog_courier(f) for f in range(4)]
    yield "frog-courier", [("ride", ride, 100), ("idle", [ride[0]], 400)]
    yield (
        "ferret-trap-snap",
        [("set", [snap_trap(137)], 400), ("snap", [snap_trap(a, jolt=j) for a, j in SNAP], [60, 60, 80, 80])],
    )


ONCE = {"ferret-trap-snap": ["snap"]}
HITBOX = {"frog-courier": (6, 6, 48, 30), "ferret-trap-snap": (4, 14, 42, 12)}


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, once=ONCE, hitboxes=HITBOX)
