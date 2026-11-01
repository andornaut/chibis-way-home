"""Home-city rabbit antagonist, facing right with upright ears and a small round tail.

Frustration: four120ms looping headshake and raised wing/paw poses, fixed feet, no world displacement.

Usage: python3 -I art/tools/rabbit.py build | preview OUT.png, from the repository root.
48x48 frames, bottom centre (24,48), fixed mirrored hitbox (2,2,44,46) enclosing every visible pixel.
Soft grey-brown, cream and quiet warm ear accents distinguish the rabbit from the other antagonists.
Idle 2x400ms, hop 4x100ms, rest 2x400ms; all loop. Gameplay owns hop displacement and state durations.
Hop poses compress, extend, tuck and land without baking world movement into the frame anchor.
Every state remains lethal. No red contact outline, portrait, clothing, name or dialogue is included.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bird
import pixel
from pixel import Grid, K

KEY = "rabbit-antagonist"
SRC = "art/antagonists"
ONCE = {KEY: []}
HITBOX = {KEY: (2, 2, 44, 46)}


def draw(state="idle", phase=0):
    g = Grid(48, 48)
    squash = state == "hop" and phase in (0, 3)
    tuck = state == "hop" and phase == 2
    resting = state == "rest"
    lift = 1 if phase % 2 and state != "hop" else 0
    by = 35 - lift if not tuck else 32
    bh = 9 if squash else 11
    hx, hy = (31, 25 - lift) if squash else (31, 22 - lift)
    if tuck:
        hy -= 2
    if state == "frustration":
        lift = 0
        by, hx, hy = 35, 31 + (-2, 1, 2, -1)[phase], 22
    # Ears stay upright and recognisable even in the compressed preparation pose.
    for base_ex, ey, base_angle in ((25, hy - 10, -0.12), (33, hy - 11, 0.12)):
        ex, angle = base_ex, base_angle
        if state == "frustration":
            ex += (-2, 1, 2, -1)[phase]
            angle += (-0.35, 0.25, 0.35, -0.25)[phase]
        bird.cel(g, bird.in_ell(ex, ey, 3, 6, angle), "grey", "dslate", "lgrey", 1, 1)
        g.rect(ex - 1, ey - 3, 2, 6, "tan")
    bird.cel(g, bird.in_ell(9, by - 1, 4, 4), "cream", "lgrey", "white", 1, 1)
    bird.cel(g, bird.in_ell(22, by, 13, bh), "grey", "dslate", "lgrey", 2, 1)
    # Broad haunch and short foreleg make a rabbit silhouette rather than a dog gait.
    bird.cel(g, bird.in_ell(17, by + 3, 7, 6), "lgrey", "grey", None, 2, 1)
    if tuck:
        bird.cel(g, bird.in_ell(27, 39, 6, 3), "cream", "lgrey", None, 1, 1)
    else:
        g.rect(14, 43, 10, 4, "cream")
        g.rect(30, 37 if not squash else 40, 4, 10 if not squash else 7, "lgrey")
        g.rect(29, 45, 9, 2, "cream")
    bird.cel(g, bird.in_ell(hx, hy, 8, 7), "grey", "dslate", "lgrey", 2, 1)
    bird.cel(g, bird.in_ell(36, hy + 3, 5, 3), "cream", "lgrey", None, 1, 1)
    g.rect(38, hy + 1, 3, 2, "brown")
    g.rect(33, hy - 2, 3, 1 if resting else 3, "ink")
    if state == "frustration":
        g.ell(39, 33 if phase % 2 == 0 else 37, 3, 3, "lgrey")
    return g.outlined(lambda c: K["navy"] if c in (K["grey"], K["dslate"]) else K["dslate"])


def sprites():
    yield (
        KEY,
        [
            ("idle", [draw("idle", i) for i in range(2)], 400),
            ("hop", [draw("hop", i) for i in range(4)], 100),
            ("rest", [draw("rest", i) for i in range(2)], 400),
            ("frustration", [draw("frustration", i) for i in range(4)], 120),
        ],
    )


if __name__ == "__main__":
    pixel.main(
        sys.argv, sprites, SRC, __doc__, grounds=(K["zone-peach"], K["slate"], K["cream"]), once=ONCE, hitboxes=HITBOX
    )
