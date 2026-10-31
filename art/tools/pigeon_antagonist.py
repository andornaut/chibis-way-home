#!/usr/bin/env python3
"""Pebble, the pigeon antagonist, and a separate falling white-block hazard. Neither adds story or text.

Usage: pigeon_antagonist.py build | preview OUT.png
Run from the repository root. Sources: art/antagonists/. Exports: public/art/sprites/.

pigeon-antagonist: 48x48, facing right; bottom-centre anchor 24,48. Fixed hitbox 2,2,44,46 contains every
pose and its mirror. Perched feet end on row 46, with their outline on 47. Grey and lilac feathers, a
cream breast, short beak and rounded head distinguish this pigeon from Chibi. No clothes or red outline.
Tags in frame order: idle 2x400ms; prepare 2x160ms; fly 4x100ms; drop 2x100ms; rest 2x400ms;
frustration 4x120ms. Every tag loops, once []. Prepare raises the head; fly flaps; drop tucks the feet
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


def draw(state="idle", phase=0):
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
    sheet = Image.new("RGBA", (720, 360), pixel.rgb("zone-purple") + (255,))
    for row, (_, frames, _) in enumerate(tags):
        for col, px in enumerate(frames):
            sheet.alpha_composite(image(px), (24 + col * 72, 8 + row * 56))
    sheet.alpha_composite(image(poop()), (368, 24))
    sheet.save(out)
    stem, _ = os.path.splitext(out)
    scene = context("drop", 0)
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
                   once=ONCE, hitboxes=HITBOX)
