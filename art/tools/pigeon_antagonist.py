#!/usr/bin/env python3
"""Pebble, the pigeon antagonist, and a separate falling white-block hazard. Neither adds story or text.

Usage: pigeon_antagonist.py build | preview OUT.png
Run from the repository root. Sources: art/antagonists/. Exports: public/art/sprites/.

pigeon-antagonist: 48x48, facing right; bottom-centre anchor 24,48. Fixed hitbox 2,2,44,46 contains every
pose and its mirror. Perched feet end on row 46, with their outline on 47. Grey and lilac feathers, a
cream breast, short beak and rounded head distinguish this pigeon from Chibi. No clothes or red outline.
Tags in frame order: idle 2x400ms; prepare 2x160ms; fly 4x100ms; drop 2x100ms; rest 2x400ms;
frustration 4x120ms; swoop 4x100ms; prepare-air 2x160ms. Every tag loops, once []. Prepare raises the head;
prepare-air tucks the feet, draws the wings back and aims the head before an airborne attack. Fly flaps;
drop tucks the feet
and lifts the tail; frustration shakes the head and flaps one wing. Generic gameplay owns movement,
perching, spotting, projectile release and state durations. The art does not add a physical perch.

pigeon-poop: 12x12, full-cell hitbox 0,0,12,12, tag idle 1x400ms, loop, once []. A plain white square
with a 1px ink border keeps this user-approved white hazard visible on pale sky. No splatter or effect.
Preview includes a native contact sheet and an illustrative industrial-lavender scene/GIF, not a simulation.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
from pixel import Grid, K  # noqa: E402
from PIL import Image, ImageDraw, ImageOps  # noqa: E402

SRC = "art/antagonists"
KEY = "pigeon-antagonist"
POOP = "pigeon-poop"
ONCE = {KEY: [], POOP: []}
HITBOX = {KEY: (2, 2, 44, 46), POOP: (0, 0, 12, 12)}


def wing(g, pose, lift):
    """Near wing's broad feather groups, with no one-pixel texture."""
    if pose == "up":
        g.blob(14, 19 - lift, 6, 10, "grey", sh="slate", li="lgrey")
        g.rect(9, 12 - lift, 3, 9, "slate")
        g.rect(13, 9 - lift, 2, 10, "slate")
    elif pose == "half":
        g.blob(13, 27 - lift, 9, 6, "grey", sh="slate", li="lgrey")
        g.rect(7, 27 - lift, 8, 2, "slate")
    elif pose == "down":
        g.blob(17, 35 - lift, 6, 9, "grey", sh="slate", li="lgrey")
        g.rect(13, 37 - lift, 3, 4, "slate")
    else:
        g.blob(19, 33 - lift, 9, 6, "slate", li="grey")
        g.rect(13, 35 - lift, 9, 2, "navy")


def swoop(phase):
    """Head below the breast and wings swept upward distinguish a contact dive from level flight."""
    g = Grid(48, 48)
    g.tri((5, 15), (18, 16), (20, 28), "slate")
    g.blob(24, 27, 12, 10, "grey", sh="slate", li="lgrey")
    g.ell(30, 31, 7, 8, "cream")
    for x, y, rx, ry in ((13, 13 + phase % 2 * 4, 6, 9), (23, 16 + phase % 2 * 4, 5, 9)):
        g.blob(x, y, rx, ry, "grey", sh="slate", li="lgrey")
        g.rect(x - 2, y - 5, 2, 8, "slate")
    g.rect(22, 36, 5, 2, "pink")
    g.ell(32, 30, 7, 7, "zone-purple-shade")
    hx, hy = 34, 33 + (0, 1, 0, -1)[phase]
    g.blob(hx, hy, 8, 7, "grey", sh="slate", li="lgrey")
    g.tri((39, hy + 3), (43, hy + 8), (36, hy + 6), "brown")
    g.rect(36, hy - 1, 3, 3, "ink")
    g.rect(36, hy - 1, 2, 2, "cream")
    return g.outlined(lambda c: K["navy"])


def prepare_air(phase):
    """Held airborne anticipation: tucked feet, swept-back wings and a forward/downward head aim."""
    g = Grid(48, 48)
    g.tri((5, 25), (19, 25), (18, 37), "slate")
    g.blob(25, 29, 12, 10, "grey", sh="slate", li="lgrey")
    g.ell(31, 30, 7, 9, "cream")
    g.rect(23, 38, 4, 2, "pink")
    g.rect(29, 38, 4, 2, "pink")
    # Both wings draw behind the breast rather than continuing the regular wingbeat.
    g.blob(14, 19 - phase, 8, 7, "grey", sh="slate", li="lgrey")
    g.tri((6, 12 - phase), (20, 18), (17, 28), "slate")
    g.rect(9, 16 - phase, 7, 2, "lgrey")
    g.ell(30, 25, 7, 7, "zone-purple-shade")
    hx, hy = 33, 21 + phase
    g.blob(hx, hy, 8, 7, "grey", sh="slate", li="lgrey")
    g.tri((39, hy + 1), (43, hy + 6), (37, hy + 5), "brown")
    g.rect(35, hy - 2, 4, 3, "ink")
    g.rect(35, hy - 2, 2, 2, "cream")
    return g.outlined(lambda c: K["navy"])


def draw(state="idle", phase=0):
    if state == "prepare-air":
        return prepare_air(phase)
    if state == "swoop":
        return swoop(phase)
    g = Grid(48, 48)
    air = state in ("fly", "drop")
    lift = (3, 4, 3, 4)[phase % 4] if air else phase % 2 if state in ("idle", "rest") else 0
    shake = (-1, 1, -1, 1)[phase] if state == "frustration" else 0
    alert = (1 + phase) if state == "prepare" else 0
    # A short pointed tail and upright breast supply the pigeon silhouette.
    tail_y = 29 - lift if state == "drop" else 35 - lift
    g.tri((5, tail_y - 2), (18, tail_y - 4), (17, tail_y + 6), "slate")
    if not air:
        for x in (21, 29):
            g.rect(x, 41, 2, 5, "pink")
            g.rect(x - 2, 45, 6, 2, "pink")
    else:
        for x in (24, 30):
            g.rect(x, 39 - lift, 4, 2, "pink")
    g.blob(25, 33 - lift, 13, 11, "grey", sh="slate", li="lgrey")
    g.ell(31, 33 - lift, 7, 10, "cream")
    g.ell(29, 25 - lift, 7, 7, "zone-purple-shade")
    wing_pose = ("up", "half", "down", "half")[phase] if state == "fly" else \
        ("up", "half")[phase] if state == "drop" else \
        "half" if state == "frustration" and phase % 2 else "folded"
    wing(g, wing_pose, lift)
    hx, hy = 30 + shake, 17 - lift - alert
    g.blob(hx, hy, 9, 8, "grey", sh="slate", li="lgrey")
    g.tri((hx + 8, hy + 1), (hx + 13, hy + 4), (hx + 8, hy + 5), "brown")
    # A soft dot eye, never an angry brow; alert and rest use distinct eye shapes.
    if state == "rest":
        g.rect(hx + 3, hy - 1, 4, 1, "ink")
    else:
        g.rect(hx + 3, hy - 3, 4 if state == "prepare" else 3, 3, "ink")
        g.rect(hx + 3, hy - 3, 2, 2, "cream")
    return g.outlined(lambda c: K["navy"])


def poop():
    g = Grid(12, 12)
    g.rect(0, 0, 12, 12, "ink")
    g.rect(1, 1, 10, 10, "white")
    return g.px


def sprites():
    yield KEY, [
        ("idle", [draw("idle", i) for i in range(2)], 400),
        ("prepare", [draw("prepare", i) for i in range(2)], 160),
        ("fly", [draw("fly", i) for i in range(4)], 100),
        ("drop", [draw("drop", i) for i in range(2)], 100),
        ("rest", [draw("rest", i) for i in range(2)], 400),
        ("frustration", [draw("frustration", i) for i in range(4)], 120),
        ("swoop", [draw("swoop", i) for i in range(4)], 100),
        ("prepare-air", [draw("prepare-air", i) for i in range(2)], 160),
    ]
    yield POOP, [("idle", [poop()], 400)]


def image(px):
    im = Image.new("RGBA", (len(px[0]), len(px)))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), pixel.rgb(c) + (255,))
    return im


def context(state="idle", phase=0):
    im = Image.new("RGBA", (720, 360), pixel.rgb("zone-purple") + (255,))
    d = ImageDraw.Draw(im)
    for x, y, w in ((0, 110, 150), (170, 150, 130), (470, 95, 180), (650, 150, 70)):
        d.rectangle((x, y, x + w, 260), fill=pixel.rgb("zone-purple-shade") + (255,))
    d.rectangle((0, 260, 719, 359), fill=pixel.rgb("dslate") + (255,))
    d.rectangle((0, 260, 719, 260), fill=pixel.rgb("navy") + (255,))
    d.rectangle((0, 261, 719, 262), fill=pixel.rgb("white") + (255,))
    # Plain post illustrates placement only; the reusable physical structure belongs to gameplay.
    d.rectangle((215, 220, 238, 259), fill=pixel.rgb("slate") + (255,))
    d.rectangle((215, 220, 238, 220), fill=pixel.rgb("navy") + (255,))
    d.rectangle((215, 221, 238, 222), fill=pixel.rgb("white") + (255,))
    px = 203 if state in ("idle", "prepare", "rest", "frustration") else 300
    py = 172 if px == 203 else 120
    im.alpha_composite(image(draw(state, phase)), (px, py))
    bird = Image.open("public/art/sprites/bird.png").convert("RGBA").crop((0, 0, 48, 42))
    im.alpha_composite(bird, (440, 218))
    if state == "drop":
        im.alpha_composite(image(poop()), (319, 174 + phase * 10))
    return im


def preview(out):
    tags = list(sprites())[0][1]
    sheet = Image.new("RGBA", (720, max(360, len(tags) * 56 + 16)), pixel.rgb("zone-purple") + (255,))
    for row, (_, frames, _) in enumerate(tags):
        for col, px in enumerate(frames):
            sheet.alpha_composite(image(px), (24 + col * 72, 8 + row * 56))
    sheet.alpha_composite(image(poop()), (368, 24))
    sheet.save(out)
    stem, _ = os.path.splitext(out)
    scene = context("prepare-air", 0)
    scene.save(stem + "-context.png")
    scene.resize((864, 432), Image.Resampling.NEAREST).save(stem + "-phone.png")
    ImageOps.grayscale(scene).save(stem + "-grey.png")
    sequence = [context(state, i) for state, poses, _ in tags for i in range(len(poses))]
    durations = [ms for _, poses, ms in tags for _ in poses]
    sequence[0].save(stem + ".gif", save_all=True, append_images=sequence[1:], duration=durations, loop=0)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    else:
        pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(K["zone-purple"], K["slate"], K["cream"]),
                   once=ONCE, hitboxes=HITBOX, contacts=(KEY,))
