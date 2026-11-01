#!/usr/bin/env python3
"""Trixi, the countryside goose antagonist with oversized glasses: a long-necked cream-and-grey bird, distinct from the
round bird.

Usage, from the repository root:
  python3 -I art/tools/goose.py build
  python3 -I art/tools/goose.py preview OUT.png

goose-antagonist: 48x48, facing right and mirrored for left, bottom centre (24,48). Standing feet occupy rows45..46
with their outline on47. All visible pixels remain inside the fixed hitbox (2,2,44,46), also when mirrored.
No red outline, portrait or story details are baked into this asset; oversized ink glasses are the costume cue.

A narrow upright neck, small round head, cream feather mass with pale grey shade, grey wing and warm orange
bill/feet distinguish the goose from the bird. Warn raises a broad wing and the neck. Rush lowers the neck
forward into a short committed charge; rest is still lethal, never a safe state. No teeth or scary snarl.

Tags in frame order: idle 2x400ms; walk 4x120ms; warn 2x160ms; rush 4x80ms; rest 2x400ms.
Frustration appends 4x120ms: a short headshake and low wing flaps, feet planted.
Set-trap appends 4x120ms: a groundward head and wing placement gesture; no trap type or object is depicted.
All tags loop. These are art cycle defaults; gameplay owns state durations and all physical movement.
The build writes art/antagonists/goose-antagonist.aseprite and its PNG/JSON exports.

goose-trap: 24x12, bottom-centre 12,12, fixed contact bounds 0,9,24,3. Warning loops 4x120ms with
an amber edge and moving 2px yellow tick over a 1px ink rim. Armed loops 1x400ms with the shared solid
3px bright-red panel on rows9..11, transparent above. No spikes or teeth. Generic gameplay owns
the visible arming delay and enables collision only when armed; metadata declares the fixed shape only.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bird  # noqa: E402
import pixel  # noqa: E402
import obstacles  # noqa: E402
from pixel import Grid, K  # noqa: E402

KEY = "goose-antagonist"
SRC = "art/antagonists"
TRAP = "goose-trap"
ONCE = {KEY: [], TRAP: []}
HITBOX = {KEY: (2, 2, 44, 46), TRAP: (0, 9, 24, 3)}


def neck_shape(points):
    """A smooth, connected feathered neck from overlapping three-pixel-radius discs."""
    discs = []
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(steps + 1):
            t = i / max(1, steps)
            discs.append(bird.in_ell(x0 + t * (x1 - x0), y0 + t * (y1 - y0), 3.2, 3.2))
    return lambda x, y: any(f(x, y) for f in discs)


def draw(state="idle", phase=0):
    g = Grid(48, 48)
    moving = state in ("walk", "rush")
    rushing = state == "rush"
    warning = state == "warn"
    resting = state == "rest"
    lift = phase % 2 if moving else phase if state in ("idle", "rest") else 0
    by = 34 - lift
    # Feet remain the ground reference even while the torso rises on a passing pose.
    stride = (-2, 0, 2, 0)[phase] if moving else 0
    for i, x in enumerate((17 + stride, 27 - stride)):
        up = 2 if moving and phase in (0, 2) and i == phase // 2 else 0
        g.rect(x, 41 - lift, 2, 5 + lift - up, "orange")
        g.rect(x - 1, 45 - up, 5, 2, "orange")
    # The warning wing is a broad feather shape, not a flash or contact marker.
    if warning:
        angle = -0.65 if phase == 0 else -0.78
        bird.cel(g, bird.in_ell(14, 20 - phase, 4, 12, angle), "lgrey", "grey", "white", 2, 1)
    bird.cel(g, bird.in_ell(7, by - 2, 3.8, 2.5, -0.4), "cream", "lgrey", None, 1, 1)
    bird.cel(g, bird.in_ell(21, by, 14.5, 9.5), "cream", "lgrey", "white", 3, 1)
    if rushing:
        hx, hy = 37, 25 - lift
        points = [(28, by - 1), (31, 28 - lift), (34, 25 - lift), (hx, hy)]
    elif warning:
        hx, hy = 33 + phase, 8
        points = [(28, by - 2), (31, 23), (30, 14), (hx, hy + 1)]
    else:
        hx, hy = (32, 12 - lift) if resting else (33, 10 - lift)
        points = [(28, by - 2), (30, 23 - lift), (30, 16 - lift), (hx, hy + 1)]
    if state == "set-trap":
        hx, hy = ((33, 10), (35, 19), (35, 30), (33, 19))[phase]
        points = [(28, by - 2), (29, 26), (32, 23), (hx, hy + 1)]
    if state == "frustration":
        hx += (-1, 1, -1, 1)[phase]
        hy += (1, 0, 1, 0)[phase]
        points[-1] = (hx, hy + 1)
    bird.cel(g, neck_shape(points), "cream", "lgrey", "white", 2, 1)
    bird.cel(g, bird.in_ell(hx, hy, 5.5, 5), "cream", "lgrey", "white", 2, 1)
    # A short bill and high dot eye retain a soft expression while keeping the neck unmistakable.
    g.rect(int(hx + 4), int(hy), 4, 3, "orange")
    g.rect(int(hx + 1), int(hy - 2), 3, 1 if resting else 3, "ink")
    if not warning:
        bird.cel(g, bird.in_ell(20, by + 1, 8, 4.5, -0.2), "grey", "dslate", None, 2, 1)
    if state == "frustration":
        angle = -0.45 if phase % 2 else 0.4
        bird.cel(g, bird.in_ell(19, 30 if phase % 2 else 35, 11, 4, angle),
                 "lgrey", "grey", "white", 2, 1)
    if state == "set-trap":
        bird.cel(g, bird.in_ell(25, (35, 38, 41, 38)[phase], 8, 3, 0.3),
                 "grey", "dslate", None, 2, 1)
    px = g.outlined(lambda c: K["navy"] if c in (K["grey"], K["dslate"]) else K["dslate"])
    return glasses(px, hx, hy, resting)


def glasses(px, hx, hy, resting=False):
    """Oversized paired ink rims, a short bridge and temple, contained inside the shared contact box."""
    g = Grid(48, 48)
    g.px = [row[:] for row in px]
    g.rect(hx - 9, hy - 2, 5, 2, "ink")
    for x in (hx - 4, hx + 3):
        g.ell(x, hy - 1, 4, 4, "ink")
        g.ell(x, hy - 1, 2.6, 2.6, "lgrey")
    g.rect(hx - 1, hy - 2, 3, 2, "ink")
    g.rect(hx + 3, hy - 1, 2, 1 if resting else 2, "ink")
    return g.px


def trap(state="armed", phase=0):
    """Repeat the canonical top-contact strip; only warning colour and its moving tick differ."""
    tile = obstacles.hazard("top")
    g = Grid(24, 12)
    for y in range(12):
        for x in range(24):
            c = tile.getpixel((x % 12, y))
            if c[3]:
                g.p(x, y, "amber" if state == "warning" and c[:3] == pixel.rgb("red") else
                    "%02x%02x%02x" % c[:3])
    if state == "warning":
        g.rect(0, 11, 24, 1, "ink")
        g.rect(2 + phase * 4, 9, 2, 2, "yellow")
    return g.px


def sprites():
    yield KEY, [
        ("idle", [draw("idle", i) for i in range(2)], 400),
        ("walk", [draw("walk", i) for i in range(4)], 120),
        ("warn", [draw("warn", i) for i in range(2)], 160),
        ("rush", [draw("rush", i) for i in range(4)], 80),
        ("rest", [draw("rest", i) for i in range(2)], 400),
        ("frustration", [draw("frustration", i) for i in range(4)], 120),
        ("set-trap", [draw("set-trap", i) for i in range(4)], 120),
    ]
    yield TRAP, [
        ("warning", [trap("warning", i) for i in range(4)], 120),
        ("armed", [trap()], 400),
    ]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(K["zone-green"], K["slate"], K["cream"]),
               once=ONCE, hitboxes=HITBOX, contacts=(KEY,))
