"""The first antagonist dog and its dialogue portrait, facing right with no baked hazard outline.

Anticipate-lift appends load120ms, lift160ms and return-brace200ms, playing once
and holding its final prepared pose. The visual lift stays inside the existing
frame and reach envelope; world position and physical movement stay unchanged.
Gameplay owns the tell window. New frames have exact alpha-derived contact masks.

Usage: antagonists.py build | preview OUT.png
Run from the repository root. Sources: art/antagonists/. Exports: public/art/sprites/.

dog-antagonist is Archie, an Australian Shepherd with a brown coat, white blaze, ruff and paws.
Frame 60x40, feet on row 39; all visible pixels stay inside hitbox x2,y2,width56,height38. Contact is lethal
in every state, including crouch and rest. The game does not draw a red contact rectangle or silhouette
outline; the hitbox remains collision metadata.
Tags: idle 2x400ms; walk 4x120ms; crouch 1x400ms; rush 2x80ms; rest 2x400ms;
frustration 4x120ms; pounce 4x100ms. These earlier tags loop; gameplay owns state duration and the pounce arc.
The torso clears the ground above straight chibi legs, tapering into white stockings and small paws.
Hindlegs attach near the rump; forelegs attach beneath the shoulder. Walk exchanges diagonal pairs;
rush alternates extension and gathered limbs.
Crouch bends the limbs beneath the lowered torso. Frustration lifts the torso 3px then 5px with
folded ears kept inside the frame, a headshake and lifted forepaw, followed by a planted landing.
Pounce uses a crouched takeoff, two extended airborne poses and a compressed landing.
Rest closes the eye. Idle breath lifts the torso 1px while the feet stay planted.
All frame alpha is paired with exact contact silhouettes and requires physics review when changed.

portrait-dog is 64x64, right-facing towards text, transparent behind, chest cut off at the bottom, with
one ink outer line. Tag neutral: 1x1000ms. It shares the brown and white coat, rose ears, red bandana
and sky/amber eyes.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from PIL import Image, ImageDraw

SRC = "art/antagonists"


def rgba(name):
    return (*pixel.rgb(name), 255)


ONCE = {"dog-antagonist": ["anticipate-lift"], "portrait-dog": []}
HITBOX = {"dog-antagonist": (2, 2, 56, 38)}


def dog_image(state, phase=0):
    """Keep straight chibi legs attached to the rump and shoulder inside the fixed frame."""
    im = Image.new("RGBA", (60, 40))
    d = ImageDraw.Draw(im)
    crouch = state == "crouch" or (state == "pounce" and phase in (0, 3))
    airborne = state == "pounce" and phase in (1, 2)
    rush = state == "rush" or airborne
    hop = (0, 3, 5, 0)[phase] if state == "frustration" else 0
    bob = -1 if state in ("patrol", "rest") and phase % 2 else 0
    by = (20 if crouch else 16 if rush else 14) + bob - hop
    hy = (13 if crouch else 10 if rush else 6) + bob - hop
    if airborne:
        by -= 3
        hy -= 3
    if state == "pounce" and phase == 3:
        by += 2
        hy += 2
    if state == "frustration":
        hy = max(5, hy + (1, 0, 1, 2)[phase])
    # The bobtail attaches at the rump, above the hindlimb roots.
    d.polygon(((5, by + 3), (11, by + 4), (13, by + 10), (6, by + 10), (3, by + 7)), fill=rgba("plum"))
    d.polygon(((5, by + 4), (10, by + 5), (11, by + 8), (6, by + 8)), fill=rgba("brown"))
    d.rectangle((4, by + 5, 6, by + 7), fill=rgba("white"))

    def limb(root, ankle, toe, far=False):
        # Straight chibi legs taper gently from the rump or shoulder into small white paws.
        x, y = root
        ax, ay = ankle
        tx, ty = toe
        d.polygon(
            ((x - 2, y), (x + 2, y), (ax + 2, ay), (tx + 3, ty - 2), (tx + 3, ty), (ax - 2, ty), (ax - 2, ay)),
            fill=rgba("plum"),
        )
        d.line((x, y + 1, ax, ay), fill=rgba("dbrown" if far else "brown"), width=3)
        d.line((ax, ay - 2, ax, ty - 1, tx + 2, ty - 1), fill=rgba("lgrey" if far else "white"), width=2)

    ground = 39 - hop - (3 if airborne else 0)
    # Each table gives straight hindleg and foreleg strokes for a diagonal pair.
    if state == "walk":
        stride = ((-3, 3, 0, 0), (0, 0, -3, 2), (3, -3, 0, 0), (0, 0, 2, -3))[phase]
        rear, front, rear_lift, front_lift = stride
    elif rush:
        rear, front, rear_lift, front_lift = ((-6, 7, -2, -5), (4, -3, -5, 0))[phase % 2]
    else:
        rear, front, rear_lift, front_lift = 0, 0, 0, 0
    if state == "frustration" and phase in (1, 2):
        front_lift = -6
    # Far legs remain visible in the belly gap and exchange support with the near pair.
    limb((17, by + 9), (20 - rear, ground + front_lift - 2), (20 - rear, ground + front_lift - 1), True)
    limb((34, by + 8), (31 - front, ground + rear_lift - 2), (31 - front, ground + rear_lift - 1), True)
    # The belly clears the ground so the four legs read as limbs rather than white blocks.
    d.ellipse((9, by, 41, by + 15), fill=rgba("plum"))
    d.ellipse((10, by + 1, 40, by + 14), fill=rgba("dbrown"))
    d.ellipse((10, by + 1, 38, by + 11), fill=rgba("brown"))
    d.arc((11, by + 1, 37, by + 12), 190, 275, fill=rgba("skin2"), width=2)
    d.polygon(
        ((31, by + 2), (39, by + 2), (44, by + 10), (39, by + 16), (34, by + 15), (29, by + 9)), fill=rgba("lgrey")
    )
    d.polygon(
        ((32, by + 2), (38, by + 2), (42, by + 9), (37, by + 14), (33, by + 12), (30, by + 8)), fill=rgba("white")
    )
    limb((12, by + 8), (12 + rear, ground + rear_lift - 2), (12 + rear, ground + rear_lift))
    limb((38, by + 8), (38 + front, ground + front_lift - 2), (38 + front, ground + front_lift))
    # A broad skull, folded rose ears and projecting white muzzle retain Archie's identity.
    shake = (-1, 1, -1, 0)[phase] if state == "frustration" else 0
    head = Image.new("RGBA", im.size)
    d = ImageDraw.Draw(head)
    d.polygon(((39, hy + 4), (43, hy - 3), (48, hy + 5)), fill=rgba("plum"))
    d.polygon(((40, hy + 3), (43, hy - 1), (46, hy + 4)), fill=rgba("dbrown"))
    d.ellipse((31, hy, 53, hy + 20), fill=rgba("plum"))
    d.ellipse((32, hy + 1, 52, hy + 19), fill=rgba("brown"))
    d.polygon(
        ((44, hy + 1), (47, hy + 2), (48, hy + 10), (51, hy + 14), (42, hy + 14), (44, hy + 7)), fill=rgba("white")
    )
    d.polygon(
        ((44, hy + 11), (54, hy + 10), (57, hy + 12), (57, hy + 16), (52, hy + 19), (44, hy + 18), (41, hy + 15)),
        fill=rgba("plum"),
    )
    d.polygon(
        ((44, hy + 12), (54, hy + 11), (56, hy + 13), (56, hy + 15), (51, hy + 17), (44, hy + 17), (43, hy + 15)),
        fill=rgba("white"),
    )
    d.rectangle((54, hy + 11, 57, hy + 13), fill=rgba("ink"))
    d.polygon(((32, hy + 5), (34, hy - 2), (41, hy + 3), (38, hy + 11), (34, hy + 10)), fill=rgba("plum"))
    d.polygon(((33, hy + 5), (35, hy), (39, hy + 4), (37, hy + 9), (35, hy + 8)), fill=rgba("brown"))
    d.polygon(((35, hy), (31, hy + 3), (37, hy + 4)), fill=rgba("dbrown"))
    d.polygon(((33, hy + 18), (46, hy + 20), (39, hy + 24)), fill=rgba("red"))
    d.polygon(((39, hy + 21), (46, hy + 20), (39, hy + 24)), fill=rgba("dred"))
    if state == "rest":
        d.line((47, hy + 7, 50, hy + 7), fill=rgba("ink"))
    else:
        d.rectangle((47, hy + 5, 50, hy + 9), fill=rgba("ink"))
        d.rectangle((47, hy + 6, 49, hy + 8), fill=rgba("sky"))
        d.rectangle((49, hy + 7, 50, hy + 8), fill=rgba("ink"))
        d.point((47, hy + 6), fill=rgba("white"))
    im.alpha_composite(head, (shake, 0))
    # Keep all poses inside the declared reach box, including the hop's raised ears.
    im.paste((0, 0, 0, 0), (0, 0, 2, 40))
    im.paste((0, 0, 0, 0), (58, 0, 60, 40))
    im.paste((0, 0, 0, 0), (0, 0, 60, 2))
    return im


def pixels(im):
    return [
        ["{:02x}{:02x}{:02x}".format(*p[:3]) if p[3] else None for p in [im.getpixel((x, y)) for x in range(im.width)]]
        for y in range(im.height)
    ]


def portrait_image():
    im = Image.new("RGBA", (64, 64))
    d = ImageDraw.Draw(im)
    d.ellipse((12, 33, 54, 85), fill=rgba("ink"))
    d.ellipse((13, 34, 53, 84), fill=rgba("lgrey"))
    d.ellipse((13, 34, 50, 82), fill=rgba("white"))
    # High rose ears have a forward folded tip, rather than a long drop to the jaw.
    d.polygon(((15, 22), (19, 3), (32, 13)), fill=rgba("ink"))
    d.polygon(((17, 20), (20, 5), (30, 13)), fill=rgba("brown"))
    d.polygon(((20, 5), (12, 11), (22, 12)), fill=rgba("dbrown"))
    d.polygon(((43, 19), (48, 3), (57, 16)), fill=rgba("ink"))
    d.polygon(((44, 18), (48, 5), (55, 15)), fill=rgba("brown"))
    d.polygon(((48, 5), (58, 10), (48, 12)), fill=rgba("dbrown"))
    d.ellipse((15, 10, 57, 47), fill=rgba("ink"))
    d.ellipse((16, 11, 56, 46), fill=rgba("dbrown"))
    d.ellipse((16, 11, 53, 43), fill=rgba("brown"))
    d.arc((17, 12, 52, 42), 190, 275, fill=rgba("skin2"), width=2)
    # An asymmetric blaze widens into a white muzzle between the odd-coloured eyes.
    d.polygon(((42, 11), (46, 12), (47, 25), (51, 32), (39, 32), (43, 23)), fill=rgba("white"))
    d.ellipse((36, 28, 62, 44), fill=rgba("ink"))
    d.ellipse((37, 29, 61, 43), fill=rgba("lgrey"))
    d.ellipse((37, 29, 60, 41), fill=rgba("white"))
    d.rectangle((56, 29, 61, 33), fill=rgba("plum"))
    d.rectangle((56, 29, 58, 30), fill=rgba("dbrown"))
    for x, y, iris, width in ((35, 22, "sky", 5), (49, 21, "amber", 4)):
        d.rectangle((x, y, x + width, y + 5), fill=rgba("ink"))
        d.rectangle((x + 1, y + 1, x + width - 1, y + 4), fill=rgba(iris))
        d.rectangle((x + width - 2, y + 3, x + width - 1, y + 4), fill=rgba("ink"))
        d.rectangle((x + 1, y + 1, x + 2, y + 2), fill=rgba("white"))
        d.line((x, y - 1, x + width, y - 1), fill=rgba("ochre"))
    d.polygon(((17, 44), (52, 44), (35, 62)), fill=rgba("ink"))
    d.polygon(((19, 45), (50, 45), (35, 60)), fill=rgba("red"))
    d.polygon(((35, 47), (50, 45), (35, 60)), fill=rgba("dred"))
    d.point((14, 22), fill=rgba("ink"))
    return im


def anticipate_lift(phase):
    if phase == 1:
        return pixels(dog_image("frustration", 2))
    return pixels(dog_image("crouch"))


def sprites():
    yield (
        "dog-antagonist",
        [
            ("idle", [pixels(dog_image("patrol", i)) for i in range(2)], 400),
            ("walk", [pixels(dog_image("walk", i)) for i in range(4)], 120),
            ("crouch", [pixels(dog_image("crouch"))], 400),
            ("rush", [pixels(dog_image("rush", i)) for i in range(2)], 80),
            ("rest", [pixels(dog_image("rest", i)) for i in range(2)], 400),
            ("frustration", [pixels(dog_image("frustration", i)) for i in range(4)], 120),
            ("pounce", [pixels(dog_image("pounce", i)) for i in range(4)], 100),
            ("anticipate-lift", [anticipate_lift(i) for i in range(3)], (120, 160, 200)),
        ],
    )
    yield "portrait-dog", [("neutral", [pixels(portrait_image())], 1000)]


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, once=ONCE, hitboxes=HITBOX, contacts=("dog-antagonist",))
