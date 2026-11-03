"""Bini: a dark-brown quadruped bear, 48x48, bottom-centre anchor (24, 48).

Usage: bear.py build | preview OUT.png, from the repository root.
The broad high shoulders, compact barrel body, small round ears, short muzzle,
compact tail and four heavy plantigrade paws define the bear's silhouette.
Idle, preparation, growl, maul, rest, frustration and anticipation retain four
planted paw contacts. Walk and rush exchange diagonal support naturally.
Body poses use a dark-brown coat, plum shade, brown rim and warm pale muzzle.
All opaque pixels, including both facings, fit reach box (2, 2, 44, 46).
Exact per-frame alpha silhouettes define contact independently of that box.

Existing tags and indices retain their frame counts and art timings:
idle 2x400ms; prepare 2x160ms; growl 4x120ms; walk 4x120ms; rush 4x80ms;
maul 3x100ms; rest 2x400ms; frustration 4x120ms; prepare-attack 2x160ms.
These tags loop. Anticipate-lift appends load120ms, grounded compression160ms
and return-brace200ms, plays once and holds its planted final pose. Gameplay
owns tell duration and physical movement; art adds no world displacement.
The growl mouth anchor remains (36, 22).

Portrait-bear: 64x64, right-facing neutral/annoyed, one 1000ms frame each, loops.
The portrait retains the phone with its green road and cream/red dog motif;
the quadruped world body has no held phone. No new dialogue or accessory.
Bear-growl-wave: unchanged 48x32, left-centre anchor (0, 16), pulse 4x100ms once.
Its rightward grey/cream sound arcs have no contact; runtime owns the effect.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pixel
from pixel import Grid, K

SRC = "art/antagonists"
KEY = "bear-antagonist"
PORTRAIT = "portrait-bear"
WAVE = "bear-growl-wave"
ONCE = {KEY: ["anticipate-lift"], PORTRAIT: [], WAVE: ["pulse"]}
HITBOX = {KEY: (2, 2, 44, 46)}
MOUTH = (36, 22)


def phone(g, x, y):
    g.rect(x, y, 9, 13, "ink")
    g.rect(x + 1, y + 1, 7, 10, "forest")
    g.rect(x + 4, y + 1, 2, 10, "zone-green")
    g.rect(x + 2, y + 4, 4, 3, "cream")
    g.rect(x + 5, y + 3, 2, 3, "cream")
    g.rect(x + 4, y + 6, 2, 2, "red")
    g.rect(x + 3, y + 11, 3, 1, "grey")


def leg(g, far, root, foot):
    """Embed the upper limb under the moving coat and taper towards the paw."""
    colour = "plum" if far else "dbrown"
    rx, ry = root
    fx, fy = foot
    steps = max(abs(fx - rx), abs(fy - 2 - ry))
    for step in range(steps + 1):
        t = step / steps
        width = (3 if far else 4) * (1 - t) + 2.5 * t
        g.ell(rx + (fx - rx) * t, ry + (fy - 2 - ry) * t, width, 3, colour)


def draw(state="idle", phase=0):
    g = Grid(48, 48)
    walk = state in ("walk", "rush")
    stride = (-1, 0, 1, 0)[phase] if walk else 0
    bob = (0, 1, 0, 1)[phase] if walk else phase if state in ("idle", "rest") else 0
    compress = (
        (1, 3, 1)[phase]
        if state == "anticipate-lift"
        else 1 + phase
        if state == "prepare-attack"
        else 1
        if state == "prepare"
        else 0
    )
    headshift = (-1, 1, 0, -1)[phase] if state == "frustration" else 1 if state == "maul" and phase == 1 else 0
    body_y = 27 + compress - bob
    shoulder_y = 25 + compress - bob
    head_y = 19 + min(compress, 1) - bob
    if state == "growl":
        head_y = 19
    if state == "rest":
        head_y += 1
    feet = []
    roots = ((12, body_y + 4), (18, body_y + 5), (28, shoulder_y + 7), (34, shoulder_y + 4))
    for i, x in enumerate((9, 17, 29, 38)):
        up = 2 if walk and ((phase == 0 and i in (0, 2)) or (phase == 2 and i in (1, 3))) else 0
        xx = x + (stride if i in (0, 2) else -stride)
        feet.append((xx, 44 - up))
        leg(g, i in (1, 2), roots[i], feet[-1])
    g.ell(5, 32 + compress, 2, 2, "dbrown", sh="plum")
    g.blob(22, body_y, 16, 11 - compress * 0.5, "dbrown", sh="plum")
    g.rect(11, 16 + compress - bob, 8, 2, "brown")
    g.ell(29, shoulder_y, 10, 12 - compress * 0.5, "dbrown", sh="plum", li="brown")
    for x in (26 + headshift, 37 + headshift):
        g.ell(x, head_y - 11, 3, 3, "dbrown", sh="plum", li="brown")
        g.ell(x, head_y - 11, 1.5, 1.5, "plum")
    g.blob(33 + headshift, head_y, 11, 10, "dbrown", sh="plum", li="brown")
    g.ell(38 + headshift, head_y + 3, 5.5, 4, "tan", sh="brown", li="cream")
    g.rect(41 + headshift, head_y, 3, 3, "ink")
    g.rect(35 + headshift, head_y - 4, 3, 3, "ink")
    g.rect(35 + headshift, head_y - 4, 2, 2, "white")
    if state == "rest":
        g.rect(35 + headshift, head_y - 4, 3, 2, "dbrown")
    if state in ("growl", "maul"):
        g.ell(36 + headshift, head_y + 3, 3, 2 + phase % 2, "ink")
        g.rect(35 + headshift, head_y + 4, 3, 1, "brown")
    if state in ("prepare", "prepare-attack"):
        g.rect(34 + headshift, head_y - 6, 4, 1, "plum")
    for i, (x, y) in enumerate(feet):
        g.blob(x, y, 3 if i in (1, 2) else 3.5, 3, "plum" if i in (1, 2) else "dbrown", sh="ink", li="brown")
    return g.outlined(lambda _colour: K["ink"])


def portrait(annoyed=False):
    g = Grid(64, 64)
    g.blob(29, 60, 24, 22, "dbrown", sh="plum", li="brown")
    for x in (17, 42):
        g.ell(x, 15, 7, 7, "dbrown", sh="plum", li="tan")
        g.ell(x, 15, 3, 3, "plum")
    g.blob(33, 32, 22, 20, "dbrown", sh="plum", li="brown")
    g.ell(46, 40, 13, 9, "cream", sh="tan")
    g.rect(53, 35, 5, 4, "ink")
    g.rect(37, 25, 4, 5, "ink")
    g.rect(37, 26 if annoyed else 25, 2, 2, "white")
    g.rect(37, 24 if annoyed else 22, 6, 2, "plum")
    phone(g, 45, 51)
    return g.outlined(lambda _c: K["ink"])


def wave(phase):
    g = Grid(48, 32)
    for radius in (12 + phase * 2, 26 + phase * 2, 40 + phase * 2):
        for y in range(3, 29):
            for x in range(2, 46):
                d = ((x + 10) ** 2 + ((y - 16) * 1.7) ** 2) ** 0.5
                if radius - 2 <= d <= radius:
                    g.p(x, y, "cream" if phase % 2 == 0 else "lgrey")
    return g.outlined(lambda _c: K["dslate"])


def anticipate_lift(phase):
    return draw("anticipate-lift", phase)


def sprites():
    yield (
        KEY,
        [
            (state, [draw(state, i) for i in range(count)], ms)
            for state, count, ms in (
                ("idle", 2, 400),
                ("prepare", 2, 160),
                ("growl", 4, 120),
                ("walk", 4, 120),
                ("rush", 4, 80),
                ("maul", 3, 100),
                ("rest", 2, 400),
                ("frustration", 4, 120),
                ("prepare-attack", 2, 160),
            )
        ]
        + [("anticipate-lift", [anticipate_lift(i) for i in range(3)], (120, 160, 200))],
    )
    yield PORTRAIT, [("neutral", [portrait()], 1000), ("annoyed", [portrait(True)], 1000)]
    yield WAVE, [("pulse", [wave(i) for i in range(4)], 100)]


if __name__ == "__main__":
    pixel.main(
        sys.argv,
        sprites,
        SRC,
        __doc__,
        grounds=(K["zone-green"], K["slate"]),
        once=ONCE,
        hitboxes=HITBOX,
        contacts=(KEY,),
    )
