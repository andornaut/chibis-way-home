"""The climbing raccoon antagonist, separate from the retained pedestrian/room cast.

Anticipate-lift appends load120ms, lift160ms and return-brace200ms, playing once
and holding its final prepared pose. The visual lift stays inside the existing
frame and reach envelope; world position and physical movement stay unchanged.
Gameplay owns the tell window. New frames have exact alpha-derived contact masks.

Usage, from the repository root:
  python3 -I art/tools/raccoon.py build
  python3 -I art/tools/raccoon.py preview OUT.png

raccoon-antagonist: 48x48, facing right in a three-quarter front view; mirrored for left. Fixed frame-bottom
centre (24,48), feet on row46 with outline on47 when standing. Every limb and the banded tail stay inside
hitbox (2,2,44,46) for all poses. Contact is always lethal; no red contact outline is baked into the art.

The round grey head, cream face band, paired ink masks, rounded ears and thick banded tail identify the
animal. Grey fur has slate crescents and lgrey rims; the muzzle and belly are cream. A closed navy/ink
outline keeps the silhouette readable against industrial lavender. No clothing, names, portraits or teeth.

Tags, in frame order:
- idle: 2x400ms, quiet breathing, paws lowered, feet planted.
- climb: 4x120ms, opposite paws grip at alternating heights, opposite feet rise, torso lifts on passing poses.
- prepare: 1x400ms, visibly compressed and tense before the drop, paws held against the torso.
- drop: 2x100ms, splayed limbs then tucked paws and feet during descent.
- rest: 2x400ms, settled after landing; still lethal, never a safe state.
- frustration: 4x120ms, head shaking and alternating raised paws, feet planted.
- walk: 4x120ms, alternating grounded steps and opposite swinging paws.
- rush: 4x80ms, lowered forward head and body, longer strides and forward reaching paws.

All earlier motion tags loop. The generic behaviour state machine owns state timing and physical movement;
Frame durations are art cycle defaults.
Build writes art/antagonists/raccoon-antagonist.aseprite and its PNG/JSON export.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from pixel import Grid, K

SRC = "art/antagonists"
KEY = "raccoon-antagonist"
ONCE = {KEY: ["anticipate-lift"]}
HITBOX = {KEY: (2, 2, 44, 46)}


def tail(g, lift=0):
    """A thick oval tail with broad alternating bands; its tip curls towards the body."""
    for y in range(34 - lift, 44 - lift):
        for x in range(3, 21):
            if ((x + 0.5 - 12) / 8.5) ** 2 + ((y + 0.5 - (39 - lift)) / 4.3) ** 2 <= 1:
                g.p(x, y, "cream" if ((x - 3) // 3) % 2 == 0 else "ink")


def arm(g, start, paw, far=False):
    """Three-pixel connected arm, ending in a substantial dark gripping paw."""
    x0, y0 = start
    x1, y1 = paw
    steps = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(steps + 1):
        t = i / max(1, steps)
        g.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1.8, 1.8, "slate" if far else "grey")
    g.rect(x1 - 1, y1 - 1, 3, 3, "ink")


def draw(state="idle", phase=0):
    g = Grid(48, 48)
    prepare = state == "prepare"
    dropping = state == "drop"
    lift = 1 if state in ("idle", "rest") and phase else phase % 2 if state == "climb" else 0
    moving = state in ("walk", "rush")
    rushing = state == "rush"
    if moving:
        lift = phase % 2
    if dropping:
        lift = 1 + phase
    head_lift = 1 if dropping else lift
    if prepare:
        head_lift = -3
    if rushing:
        head_lift -= 3
    tail(g, lift)
    # Far legs stand behind the round body; the near paw supplies the same ground anchor.
    feet = ((22, 46), (32, 46))
    if state == "climb":
        feet = (((22, 46), (32, 42)), ((22, 45), (32, 45)), ((22, 42), (32, 46)), ((22, 45), (32, 45)))[phase]
    elif moving:
        stride = (-3, 0, 3, 0)[phase] if rushing else (-2, 0, 2, 0)[phase]
        feet = ((22 + stride, 44 if phase == 0 else 46), (32 - stride, 44 if phase == 2 else 46))
    elif dropping:
        feet = ((18, 44), (35, 43)) if phase == 0 else ((23, 43), (31, 43))
    for i, (x, y) in enumerate(feet):
        g.rect(x - 1, 38 - lift, 3, max(1, y - (38 - lift)), "slate" if i == 0 else "grey")
        g.rect(x - 2, y - 1, 4, 2, "ink")
    body_y, body_h = (38, 8) if prepare else (35 - lift, 10)
    if rushing:
        body_y, body_h = 37 - lift, 8
    g.blob(26, body_y, 10.5, body_h, "grey", sh="slate", li="lgrey")
    g.ell(27, body_y + 1, 5.5, body_h - 2, "cream")
    # Rounded ears and a large head keep the proportions distinct from the long-bodied dog.
    shake = (-1, 1, -1, 1)[phase] if state == "frustration" else 1 if rushing else 0
    hy = 18 - head_lift
    for x in (19 + shake, 37 + shake):
        g.ell(x, 9 - head_lift, 4.5, 4.5, "grey", sh="slate")
        g.ell(x, 9 - head_lift, 2.5, 2.5, "ink")
    g.blob(28 + shake, hy, 13.5, 10.5, "grey", sh="slate", li="lgrey")
    g.ell(28 + shake, hy + 3, 13, 5.5, "cream")
    g.rect(26 + shake, hy - 9, 3, 7, "slate")
    # The masks are paired patches; each carries a two-pixel square glint.
    for x in (21 + shake, 34 + shake):
        g.ell(x, hy + 1, 5, 3.7, "ink")
        g.rect(x - 1, hy - 1, 2, 2, "white")
    g.blob(29 + shake, hy + 7, 6.5, 4.5, "cream")
    g.rect(28 + shake, hy + 4, 3, 2, "ink")
    g.rect(28 + shake, hy + 8, 3, 1, "slate")
    if state == "climb":
        near, far = (((42, 13), (13, 26)), ((42, 18), (13, 21)), ((42, 25), (13, 11)), ((42, 21), (13, 17)))[phase]
    elif dropping:
        near, far = ((43, 22), (12, 25)) if phase == 0 else ((34, 36), (20, 35))
    elif moving:
        if rushing:
            near, far = ((42, 34), (15, 40)) if phase % 2 == 0 else ((38, 40), (14, 32))
        else:
            near, far = ((38, 35), (16, 40)) if phase % 2 == 0 else ((33, 40), (15, 35))
    elif state == "frustration":
        near, far = ((42, 23), (13, 36)) if phase % 2 == 0 else ((40, 35), (12, 23))
    elif prepare:
        near, far = (35, 38), (20, 38)
    else:
        near, far = (35, 39 - lift), (19, 39 - lift)
    arm(g, (34, 31 - lift), near)
    arm(g, (18, 31 - lift), far, True)
    return g.outlined(lambda c: K["ink"] if c in (K["cream"], K["white"]) else K["navy"])


def anticipate_lift(phase):
    if phase != 1:
        return draw("prepare")
    frame = draw("idle")
    return frame[2:] + [[None] * 48 for _ in range(2)]


def sprites():
    yield (
        KEY,
        [
            ("idle", [draw("idle", i) for i in range(2)], 400),
            ("climb", [draw("climb", i) for i in range(4)], 120),
            ("prepare", [draw("prepare")], 400),
            ("drop", [draw("drop", i) for i in range(2)], 100),
            ("rest", [draw("rest", i) for i in range(2)], 400),
            ("frustration", [draw("frustration", i) for i in range(4)], 120),
            ("walk", [draw("walk", i) for i in range(4)], 120),
            ("rush", [draw("rush", i) for i in range(4)], 80),
            ("anticipate-lift", [anticipate_lift(i) for i in range(3)], (120, 160, 200)),
        ],
    )


if __name__ == "__main__":
    pixel.main(
        sys.argv,
        sprites,
        SRC,
        __doc__,
        grounds=(K["zone-purple"], K["slate"], K["cream"]),
        once=ONCE,
        hitboxes=HITBOX,
        contacts=(KEY,),
    )
