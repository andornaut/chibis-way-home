"""Bini bear encounter art: cute brown bear, no outfit, contact outline, new dialogue or mechanics.

Usage: bear.py build | preview OUT.png, from repository root. Binary-alpha Endesga/house-ramp pixels.
Bear-antagonist48x48, bottom24,48, fixed hitbox2,2,44,46 all poses and mirrors. Mouth offset36,22.
Idle2x400ms seated with9x13phone; prepare2x160 annoyed looking up; growl4x120; walk4x120; rush4x80;
maul3x100 forward paw; rest2x400; frustration4x120; prepare-attack2x160. All loop, once[]. Feet remain inside fixed
frame.
Walk/rush use a low four-foot stance with alternating diagonal contacts; expressive poses stay upright.
Phone shows a tiny green road, cream dog and red bandana motif for Archie's Dog Walks, with no tiny text.
Portrait-bear64x64 faces right, neutral/annoyed each1x1000ms, both loop. No hitbox or dialogue encoded.
Bear-growl-wave48x32, left-centre anchor0,16; pulse4x100ms once[pulse], no hitbox. Rightward grey/cream
arcs depict sound only. Runtime owns range, cover/high-ground avoidance, push, damage and despawn.
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
ONCE = {KEY: [], PORTRAIT: [], WAVE: ["pulse"]}
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


def prepare_attack(phase):
    """Raised head, broad lifted chest and drawn-back paw; runtime owns the warning duration."""
    g = Grid(48, 48)
    for x in (16, 29):
        g.ell(x, 44, 5, 3, "brown", sh="dbrown")
    g.blob(23, 31, 14, 12, "brown", sh="dbrown", li="zone-peach-shade")
    g.ell(27, 31, 9, 9, "zone-peach", sh="zone-peach-shade")
    for x in (18, 34):
        g.ell(x, 7, 3, 3, "brown", sh="dbrown", li="zone-peach")
        g.ell(x, 7, 1.5, 1.5, "zone-peach-shade")
    g.blob(27, 14, 12, 9, "brown", sh="dbrown", li="zone-peach-shade")
    g.ell(34, 19, 7, 5, "cream", sh="zone-peach")
    g.rect(37, 16, 3, 3, "ink")
    g.rect(28, 11, 3, 3, "ink")
    g.rect(27, 9, 4, 1, "dbrown")
    # The connected forearm swings behind the shoulder, away from the forward attack direction.
    for y in range(22, 31):
        g.ell(14 - (30 - y) * 0.4, y, 3, 3, "brown")
    g.ell(10, 20 - phase * 2, 5, 5, "brown", sh="dbrown", li="zone-peach-shade")
    return g.outlined(lambda _c: K["navy"])


def _quadruped_leg(g, hip, foot, near):
    colour = "brown" if near else "dbrown"
    for i in range(9):
        t = i / 8
        g.ell(hip[0] + (foot[0] - hip[0]) * t, hip[1] + (foot[1] - hip[1] - 2) * t, 2 if near else 1.5, 2, colour)
    g.ell(foot[0], foot[1] - 1, 2.7 if near else 2, 2, colour, sh="dbrown")


def _quadruped(state, phase):
    """Grounded diagonal-pair contacts and one-pixel weight transfer, inside the fixed frame."""
    g = Grid(48, 48)
    rush = state == "rush"
    lift = (0, 1, 0, 1)[phase]
    near_hind = ((8, 46), (11, 46), (14, 43), (11, 46))[phase]
    far_hind = ((18, 43), (15, 46), (12, 46), (15, 46))[phase]
    far_fore = ((24, 46), (27, 46), (30, 43), (27, 46))[phase]
    near_fore = ((35, 43), (32, 46), (29, 46), (32, 46))[phase]
    if rush:
        near_hind = (round(11 + (near_hind[0] - 11) * 1.25), near_hind[1])
        near_fore = (round(32 + (near_fore[0] - 32) * 1.25), near_fore[1])
    cy, hx, hy = 33 - lift, 30, 25 - lift + (1 if rush else 0)
    _quadruped_leg(g, (16, cy + 1), far_hind, False)
    _quadruped_leg(g, (27, cy + 1), far_fore, False)
    g.ell(6, cy, 2, 2, "brown")
    g.blob(19, cy, 13.5 if rush else 13, 8.5, "brown", sh="dbrown", li="zone-peach-shade")
    g.ell(14, cy + 2, 7, 6, "brown", sh="dbrown")
    g.ell(25, cy + 2, 6, 5, "zone-peach", sh="zone-peach-shade")
    _quadruped_leg(g, (11, cy + 1), near_hind, True)
    _quadruped_leg(g, (30, cy + 1), near_fore, True)
    for x in (hx - 9, hx + 7):
        g.ell(x, hy - 9, 4, 4, "brown", sh="dbrown", li="zone-peach")
        g.ell(x, hy - 9, 2, 2, "dbrown")
    g.blob(hx, hy, 12, 10, "brown", sh="dbrown", li="zone-peach-shade")
    g.ell(hx + 7, hy + 5, 7, 5, "cream", sh="zone-peach")
    g.rect(hx + 10, hy + 2, 3, 3, "ink")
    g.rect(hx + 1, hy - 3, 3, 3, "ink")
    g.rect(hx, hy - 5, 4, 1, "dbrown")
    return g.outlined(lambda _c: K["navy"])


def draw(state="idle", phase=0):
    if state in ("walk", "rush"):
        return _quadruped(state, phase)
    if state == "prepare-attack":
        return prepare_attack(phase)
    g = Grid(48, 48)
    seated = state == "idle"
    moving = state in ("walk", "rush")
    shift = (-1, 1, 1, -1)[phase] if state == "frustration" else 0
    hy = 19 if seated else 18 - phase if state == "prepare" else 17
    hx = 27 + shift
    # Broad shoulders, round ears and a cream muzzle retain the bear silhouette at phone scale.
    for x in (18 + shift, 34 + shift):
        g.ell(x, hy - 9, 4, 4, "brown", sh="dbrown", li="zone-peach")
        g.ell(x, hy - 9, 2, 2, "dbrown")
    g.blob(24, 34, 13, 11, "brown", sh="dbrown", li="zone-peach-shade")
    g.ell(26, 35, 8, 8, "zone-peach", sh="zone-peach-shade")
    stride = (-2, 0, 2, 0)[phase] if moving else 0
    for x, dx in ((16, stride), (29, -stride)):
        g.ell(x + dx, 44, 5, 3, "brown", sh="dbrown")
    g.blob(hx, hy, 12, 10, "brown", sh="dbrown", li="zone-peach-shade")
    g.ell(hx + 7, hy + 5, 7, 5, "cream", sh="zone-peach")
    g.rect(hx + 10, hy + 2, 3, 3, "ink")
    g.rect(hx + 1, hy - 3, 3, 3, "ink")
    if state == "rest" and phase:
        g.rect(hx + 1, hy - 3, 3, 2, "brown")
    if state != "idle":
        g.rect(hx, hy - 5, 4, 1, "dbrown")
    if state in ("growl", "maul"):
        g.ell(36, 23, 3, 2 + phase % 2, "ink")
    if seated:
        phone(g, 31, 30)
        g.ell(29, 35, 3, 3, "brown")
        g.ell(41, 36 + phase, 2, 3, "brown")
    else:
        paw_x = (37, 41, 38)[phase] if state == "maul" else 35
        paw_y = 27 if state == "maul" else 29 + (phase % 2) * 5 if state == "frustration" else 35
        for i in range(6):
            t = i / 5
            g.ell(30 + (paw_x - 30) * t, 31 + (paw_y - 31) * t, 3, 3, "brown")
        g.ell(paw_x, paw_y, 3, 3, "brown", sh="dbrown")
    return g.outlined(lambda _c: K["navy"])


def portrait(annoyed=False):
    g = Grid(64, 64)
    g.blob(29, 60, 24, 22, "brown", sh="dbrown", li="zone-peach-shade")
    for x in (17, 42):
        g.ell(x, 15, 7, 7, "brown", sh="dbrown", li="zone-peach")
        g.ell(x, 15, 3, 3, "dbrown")
    g.blob(33, 32, 22, 20, "brown", sh="dbrown", li="zone-peach-shade")
    g.ell(46, 40, 13, 9, "cream", sh="zone-peach")
    g.rect(53, 35, 5, 4, "ink")
    g.rect(37, 25, 4, 5, "ink")
    g.rect(37, 24 if annoyed else 22, 6, 2, "dbrown")
    phone(g, 45, 51)
    return g.outlined(lambda _c: K["navy"])


def wave(phase):
    g = Grid(48, 32)
    for radius in (12 + phase * 2, 26 + phase * 2, 40 + phase * 2):
        for y in range(3, 29):
            for x in range(2, 46):
                d = ((x + 10) ** 2 + ((y - 16) * 1.7) ** 2) ** 0.5
                if radius - 2 <= d <= radius:
                    g.p(x, y, "cream" if phase % 2 == 0 else "lgrey")
    return g.outlined(lambda _c: K["dslate"])


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
        ],
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
