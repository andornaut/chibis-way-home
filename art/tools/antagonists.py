#!/usr/bin/env python3
"""The first antagonist dog and its dialogue portrait, facing right with no baked hazard outline.

Usage: antagonists.py build | preview OUT.png
Run from the repository root. Sources: art/antagonists/. Exports: public/art/sprites/.

dog-antagonist is Archie, an Australian Shepherd with a brown coat, white blaze, ruff and paws.
Frame 60x40, feet on row 39; all visible pixels stay inside hitbox x2,y2,width56,height38. Contact is lethal
in every state, including crouch and rest. The game does not draw a red contact rectangle or silhouette
outline; the hitbox remains collision metadata.
Tags: idle 2x400ms; walk 4x120ms; crouch 1x400ms; rush 2x80ms; rest 2x400ms. All loop; the gameplay
state machine owns how long each state lasts. Crouch lowers the head and body; rush stretches the paws;
Frustration loops 4x120ms: compressed takeoff, two little airborne poses and a planted landing stomp.
The whole body rises 3px then 5px inside the fixed frame, with a headshake and lifted forepaw.
Rest closes the eye. Idle breath lifts the torso 1px while the feet stay planted.

portrait-dog is 64x64, right-facing towards text, transparent behind, chest cut off at the bottom, with
one ink outer line. Tag neutral: 1x1000ms. It shares the brown and white coat, rose ears, red bandana
and sky/amber eyes.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

SRC = "art/antagonists"
C = lambda name: pixel.rgb(name) + (255,)
ONCE = {"dog-antagonist": [], "portrait-dog": []}
HITBOX = {"dog-antagonist": (2, 2, 56, 38)}


def dog_image(state, phase=0):
    im = Image.new("RGBA", (60, 40))
    d = ImageDraw.Draw(im)
    # Brown coat, white ruff, folded rose ears and bobtail preserve Archie's identity.
    base, shade, light = ("brown", "dbrown", "skin2")
    crouch = state == "crouch"
    rush = state == "rush"
    rest = state == "rest"
    by = 23 if crouch else 19 if rush else 16
    hy = 15 if crouch else 17 if rush else 11
    shake = (-2, 0, -2, 0)[phase] if state == "frustration" else 0
    if state == "frustration":
        hy += (0, 1, 0, 1)[phase]
    # Tail, far paws and back ear.
    d.ellipse((4, 24, 13, 31), fill=C("plum"))
    d.ellipse((5, 25, 12, 30), fill=C(base))
    d.ellipse((4, 24, 8, 27), fill=C("white"))
    for x in (16, 34):
        d.rounded_rectangle((x, by + 11, x + 4, 38), radius=1, fill=C("plum"))
    d.polygon(((38, hy + 5), (43, hy - 3), (48, hy + 5)), fill=C(shade))
    # Slender or barrel-shaped torso, with a lower-right crescent.
    d.ellipse((9, by, 42, 36), fill=C("plum"))
    d.ellipse((10, by + 1, 41, 35), fill=C(shade))
    d.ellipse((10, by + 1, 39, 32), fill=C(base))
    d.arc((11, by + 1, 38, 32), 190, 275, fill=C(light), width=2)
    d.ellipse((29, by + 3, 43, 36), fill=C("lgrey"))
    d.ellipse((29, by + 3, 41, 34), fill=C("white"))
    # Soft cheeks and a projecting muzzle, no teeth or angry brows.
    head = Image.new("RGBA", im.size) if state == "frustration" else im
    d = ImageDraw.Draw(head)
    d.polygon(((32, hy + 6), (35, hy - 3), (42, hy + 3)), fill=C("plum"))
    d.polygon(((33, hy + 4), (35, hy - 2), (40, hy + 3)), fill=C(base))
    d.polygon(((35, hy - 2), (30, hy + 2), (36, hy + 2)), fill=C(shade))
    headbox = (31, hy, 55, hy + 24)
    d.ellipse(headbox, fill=C("plum"))
    d.ellipse((headbox[0] + 1, hy + 1, headbox[2] - 1, headbox[3] - 1), fill=C(base))
    d.ellipse((43, hy + 11, 57, hy + 20), fill=C("plum"))
    d.ellipse((44, hy + 12, 57, hy + 19), fill=C("white"))
    d.rectangle((56, hy + 13, 57, hy + 15), fill=C("ink"))
    d.polygon(((32, hy + 4), (36, hy - 1), (42, hy + 6), (38, hy + 11)), fill=C("plum"))
    d.polygon(((33, hy + 4), (36, hy), (40, hy + 6), (38, hy + 9)), fill=C(base))
    d.polygon(((36, hy), (31, hy + 4), (37, hy + 4)), fill=C(shade))
    d.polygon(((44, hy + 1), (47, hy + 2), (49, hy + 13), (43, hy + 13)), fill=C("white"))
    neck = min(hy + 20, 32)
    d.polygon(((34, neck), (53, neck), (44, min(39, neck + 7))), fill=C("red"))
    d.polygon(((44, neck + 1), (53, neck), (44, min(39, neck + 7))), fill=C("dred"))
    if rest:
        d.line((48, hy + 8, 51, hy + 8), fill=C("ink"), width=1)
    else:
        d.rectangle((48, hy + 6, 51, hy + 10), fill=C("ink"))
        d.rectangle((48, hy + 7, 50, hy + 9), fill=C("sky"))
        d.rectangle((50, hy + 8, 51, hy + 9), fill=C("ink"))
        d.point((48, hy + 7), fill=C("white"))
    if state == "frustration":
        im.alpha_composite(head, (shake, 0))
        d = ImageDraw.Draw(im)
    # Near paws clearly change readiness and stretch.
    feet = ((12, 34, 18, 39), (38, 34, 45, 39)) if not rush else ((6, 33, 16, 39), (43, 30, 54, 35))
    if state == "frustration":
        feet = ((12, 34, 18, 39), (39, 27 if phase % 2 else 30, 46, 33 if phase % 2 else 36))
    for box in feet:
        d.rounded_rectangle(box, radius=1, fill=C("plum"))
        d.rectangle((box[0] + 1, box[1], box[2] - 1, box[3] - 1), fill=C("white"))
    im.paste((0, 0, 0, 0), (0, 0, 2, 40))
    im.paste((0, 0, 0, 0), (58, 0, 60, 40))
    im.paste((0, 0, 0, 0), (0, 0, 60, 2))
    if state in ("patrol", "rest") and phase % 2:
        shifted = Image.new("RGBA", im.size)
        shifted.alpha_composite(im.crop((2, 2, 58, 36)), (2, 1))
        shifted.alpha_composite(im.crop((2, 36, 58, 40)), (2, 36))
        im = shifted
    if state == "walk":
        d = ImageDraw.Draw(im)
        d.rectangle((8, 34, 46, 39), fill=(0, 0, 0, 0))
        offset = (-2, 0, 2, 0)[phase]
        for x, y in ((13 + offset, 35), (37 - offset, 34 if phase % 2 else 35)):
            d.rectangle((x, y, x + 6, 39 if y == 35 else 37), fill=C("plum"))
            d.rectangle((x + 1, y, x + 5, 38 if y == 35 else 36), fill=C("white"))
    if state == "rush" and phase:
        shifted = Image.new("RGBA", im.size)
        shifted.alpha_composite(im.crop((2, 3, 58, 40)), (2, 2))
        im = shifted
    if state == "frustration":
        # These small visual hops leave the runtime anchor and collision box fixed.
        hopped = Image.new("RGBA", im.size)
        if phase in (0, 3):
            height = 36 if phase == 0 else 35
            compressed = im.resize((60, height), Image.Resampling.NEAREST)
            hopped.alpha_composite(compressed, (0, 40 - height))
        else:
            rise = 3 if phase == 1 else 5
            hopped.alpha_composite(im, (0, -rise))
        im = hopped
    return im


def pixels(im):
    return [
        ["%02x%02x%02x" % p[:3] if p[3] else None for p in [im.getpixel((x, y)) for x in range(im.width)]]
        for y in range(im.height)
    ]


def portrait_image():
    im = Image.new("RGBA", (64, 64))
    d = ImageDraw.Draw(im)
    d.ellipse((12, 33, 54, 85), fill=C("ink"))
    d.ellipse((13, 34, 53, 84), fill=C("lgrey"))
    d.ellipse((13, 34, 50, 82), fill=C("white"))
    # High rose ears have a forward folded tip, rather than a long drop to the jaw.
    d.polygon(((15, 22), (19, 3), (32, 13)), fill=C("ink"))
    d.polygon(((17, 20), (20, 5), (30, 13)), fill=C("brown"))
    d.polygon(((20, 5), (12, 11), (22, 12)), fill=C("dbrown"))
    d.polygon(((43, 19), (48, 3), (57, 16)), fill=C("ink"))
    d.polygon(((44, 18), (48, 5), (55, 15)), fill=C("brown"))
    d.polygon(((48, 5), (58, 10), (48, 12)), fill=C("dbrown"))
    d.ellipse((15, 10, 57, 47), fill=C("ink"))
    d.ellipse((16, 11, 56, 46), fill=C("dbrown"))
    d.ellipse((16, 11, 53, 43), fill=C("brown"))
    d.arc((17, 12, 52, 42), 190, 275, fill=C("skin2"), width=2)
    # An asymmetric blaze widens into a white muzzle between the odd-coloured eyes.
    d.polygon(((42, 11), (46, 12), (47, 25), (51, 32), (39, 32), (43, 23)), fill=C("white"))
    d.ellipse((36, 28, 62, 44), fill=C("ink"))
    d.ellipse((37, 29, 61, 43), fill=C("lgrey"))
    d.ellipse((37, 29, 60, 41), fill=C("white"))
    d.rectangle((56, 29, 61, 33), fill=C("plum"))
    d.rectangle((56, 29, 58, 30), fill=C("dbrown"))
    for x, y, iris, width in ((35, 22, "sky", 5), (49, 21, "amber", 4)):
        d.rectangle((x, y, x + width, y + 5), fill=C("ink"))
        d.rectangle((x + 1, y + 1, x + width - 1, y + 4), fill=C(iris))
        d.rectangle((x + width - 2, y + 3, x + width - 1, y + 4), fill=C("ink"))
        d.point((x + 1, y + 1), fill=C("white"))
        d.line((x, y - 1, x + width, y - 1), fill=C("ochre"))
    d.polygon(((17, 44), (52, 44), (35, 62)), fill=C("ink"))
    d.polygon(((19, 45), (50, 45), (35, 60)), fill=C("red"))
    d.polygon(((35, 47), (50, 45), (35, 60)), fill=C("dred"))
    return im


def sprites():
    yield "dog-antagonist", [
        ("idle", [pixels(dog_image("patrol", i)) for i in range(2)], 400),
        ("walk", [pixels(dog_image("walk", i)) for i in range(4)], 120),
        ("crouch", [pixels(dog_image("crouch"))], 400),
        ("rush", [pixels(dog_image("rush", i)) for i in range(2)], 80),
        ("rest", [pixels(dog_image("rest", i)) for i in range(2)], 400),
        ("frustration", [pixels(dog_image("frustration", i)) for i in range(4)], 120),
    ]
    yield "portrait-dog", [("neutral", [pixels(portrait_image())], 1000)]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, once=ONCE, hitboxes=HITBOX)
