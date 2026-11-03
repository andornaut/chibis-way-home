"""Large planted background deer: 216x144, bottom-centre anchor (108, 144).

Usage: large_wildlife.py build | preview OUT.png, from repository root.
Idle: 1000, 180, 180, 1000ms. Graze: 350, 300, 300, 650, 650, 350, 300, 350ms.
Both tags loop, once[]. Flat woodland fauna tone, binary alpha, no outlines or interior detail.
Export requires art-kit 0.5.0: six columns and two rows make a 1296x288 sheet.
Four hoof patches at x33,46,126,138 occupy y140..143 in every frame.
Naturalistic compact torso, fixed planted limbs, articulated grazing neck and head.
Placement uses native dimensions and ordinary world camera movement. No locomotion,
contact mask, hitbox, portrait, interaction or dialogue.
"""

import math
import shutil
import sys
from pathlib import Path

from art_kit.aseprite import export
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel

SRC = "art/scenery"
KEY = "background-deer-large"
SIZE = (216, 144)
ANCHOR = (108, 144)
C = "#" + pixel.K["bg-woodland-fauna"]
IDLE_MS = (1000, 180, 180, 1000)
GRAZE_MS = (350, 300, 300, 650, 650, 350, 300, 350)
FOOT_PATCHES = ((30, 140, 38, 144), (43, 140, 51, 144), (123, 140, 131, 144), (135, 140, 143, 144))
ONCE = {KEY: []}


def draw(tag, i):
    im = Image.new("RGBA", SIZE)
    d = ImageDraw.Draw(im)
    for dx in (13, 0):
        hind = [
            (29 + dx, 75),
            (44 + dx, 79),
            (49 + dx, 91),
            (52 + dx, 101),
            (47 + dx, 109),
            (35 + dx, 123),
            (36 + dx, 139),
            (31 + dx, 139),
            (31 + dx, 122),
            (38 + dx, 110),
            (40 + dx, 103),
            (31 + dx, 94),
        ]
        d.polygon(hind, fill=C)
    for dx in (12, 0):
        d.polygon(
            [
                (x - 16, y)
                for x, y in [
                    (128 + dx, 75),
                    (143 + dx, 78),
                    (145 + dx, 99),
                    (141 + dx, 111),
                    (142 + dx, 127),
                    (143 + dx, 139),
                    (138 + dx, 139),
                    (136 + dx, 125),
                    (135 + dx, 110),
                    (131 + dx, 100),
                ]
            ],
            fill=C,
        )
    for x in (33, 46, 126, 138):
        d.polygon([(x - 2, 140), (x + 3, 140), (x + 4, 143), (x - 3, 143)], fill=C)
    d.polygon(
        [
            (round(28 + (x - 28) * 0.87), y)
            for x, y in [
                (28, 77),
                (30, 70),
                (34, 66),
                (41, 64),
                (58, 64),
                (80, 63),
                (102, 62),
                (121, 61),
                (134, 59),
                (143, 61),
                (149, 67),
                (152, 77),
                (152, 88),
                (148, 99),
                (138, 104),
                (128, 103),
                (117, 98),
                (104, 95),
                (89, 94),
                (73, 95),
                (58, 97),
                (45, 98),
                (36, 96),
                (30, 90),
            ]
        ],
        fill=C,
    )
    d.polygon([(34, 70), (25, 66), (20, 59 + (i == 3 and tag == "idle")), (28, 64), (39, 66)], fill=C)
    t = (0, 0.22, 0.55, 0.9, 1, 0.65, 0.28, 0)[i] if tag == "graze" else 0

    def mix(a, b):
        return tuple((round(x + (y - x) * t) for x, y in zip(a, b, strict=True)))

    neck = [
        mix(a, b)
        for a, b in zip(
            [(127, 67), (139, 49), (158, 34), (173, 38), (159, 63), (148, 93), (137, 99)],
            [(127, 67), (148, 66), (165, 85), (178, 109), (168, 119), (150, 100), (137, 98)],
            strict=True,
        )
    ]
    d.polygon([(x - 16, y) for x, y in neck], fill=C)
    hx, hy = mix((160, 42), (163, 113))
    angle = math.radians(42 * t)

    def pt(x, y):
        return (
            round(hx + x * math.cos(angle) - y * math.sin(angle)),
            round(hy + x * math.sin(angle) + y * math.cos(angle)),
        )

    d.polygon(
        [pt(x, y) for x, y in [(-14, -8), (0, -10), (13, -6), (27, -3), (29, 2), (24, 6), (10, 7), (-4, 10), (-14, 5)]],
        fill=C,
    )
    ear = 2 if tag == "idle" and i == 1 else 0
    d.polygon([pt(x, y) for x, y in [(-9, -4), (-17, -20 + ear), (-10, -19), (-2, -7)]], fill=C)
    d.polygon([pt(x, y) for x, y in [(0, -6), (7, -21), (11, -18), (7, -3)]], fill=C)
    return im


def frame(tag, phase):
    image = draw(tag, phase)
    return [
        [pixel.K["bg-woodland-fauna"] if image.getpixel((x, y))[3] else None for x in range(SIZE[0])]
        for y in range(SIZE[1])
    ]


def sprites():
    yield (
        KEY,
        [
            ("idle", [frame("idle", i) for i in range(4)], IDLE_MS),
            ("graze", [frame("graze", i) for i in range(8)], GRAZE_MS),
        ],
    )


def build():
    executable = shutil.which("aseprite")
    if executable is None:
        raise FileNotFoundError("aseprite")
    for key, tags in sprites():
        export(
            executable,
            pixel.PALETTE,
            tags,
            f"{SRC}/{key}.aseprite",
            f"{pixel.SPRITES}/{key}.png",
            f"{pixel.SPRITES}/{key}.json",
            key=key,
            columns=6,
        )
        pixel.update_manifest(
            "sprites",
            [{"key": key, "png": f"sprites/{key}.png", "json": f"sprites/{key}.json", "once": ONCE[key]}],
        )
    print("built", KEY)


if __name__ == "__main__" and sys.argv[1:] == ["build"]:
    build()
elif __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, grounds=(pixel.K["zone-green"], pixel.K["forest"]), once=ONCE)
