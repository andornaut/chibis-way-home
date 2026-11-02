"""Chibi the bird: the protagonist's sprite and his dialogue portrait.

Usage, from the repository root:
  python3 -I art/tools/bird.py build            write art/bird/<key>.aseprite and public/art/sprites/<key>.png + .json
  python3 -I art/tools/bird.py preview OUT.png  contact sheet of every frame on slate, tan and cream

Design: a wide, round cream blob of a bird with a small round head set into the top of his body at the front,
a square ink dot eye, a short plain orange bill, a flat tan wing patch and tiny orange stub feet. His back dips
at the nape, so his round head sits up above the back line, and ends in a short tail tip at the rear. Cel
shading: a tan crescent on the lower right and a white rim on the upper left. Dark-slate outline. Facing
right (the game mirrors him). No bow.

bird, 48x42. Collision body 24x36 (2x3 tiles of 12px), anchored bottom-centre: the frame's bottom edge sits on
the body's bottom edge, and his body-centre x, 24 (the frame's centre line, between columns 23 and 24), sits on
the body's centre, so mirroring his does not move it. Feet on rows 39 and 40, the outline on row 41. The 24x36
body covers columns 12 to 35 and rows 6 to 41. At rest his back and tail overhang it 8px on the left and his
head and bill 10px on the right, and he stops 2px below its top. The raised wing overhangs up to 5px above
(flutter 0); the jump crouch and land squash push his tail out to 11 and 12px on the left.

| Tag     | Frame | ms  | Pose                                                         | Lift | Body w x h | Shadow w |
| ------- | ----- | --- | ------------------------------------------------------------ | ---- | ---------- | -------- |
| idle    | 0     | 400 | rest                                                         | 0    | 33 x 26    | 34       |
| idle    | 1     | 400 | breath: body and head 1px up, feet planted                   | 1    | 33 x 26    | 34       |
| walk    | 0     | 130 | near foot forward and 2px up, far foot back                  | 0    | 33 x 26    | 34       |
| walk    | 1     | 130 | passing: feet together, body 1px up                          | 1    | 33 x 26    | 32       |
| walk    | 2     | 130 | far foot forward and 2px up (behind the body), near back     | 0    | 33 x 26    | 34       |
| walk    | 3     | 130 | passing                                                      | 1    | 33 x 26    | 32       |
| jump    | 0     | 80  | crouch: squash, wing lifting                                 | 0    | 38 x 22    | 38       |
| jump    | 1     | 100 | lift: stretch, 3px up, feet tucked, wing half raised         | 3    | 29 x 30    | 26       |
| flutter | 0     | 100 | wing up (the signature pose)                                 | 2    | 33 x 26    | 26       |
| flutter | 1     | 100 | wing back                                                    | 2    | 33 x 26    | 26       |
| flutter | 2     | 100 | wing level: the downstroke lifts the body 1px                | 3    | 33 x 26    | 26       |
| flutter | 3     | 100 | wing back                                                    | 2    | 33 x 26    | 26       |
| land    | 0     | 100 | contact: squash, feet planted wide                           | 0    | 39 x 22    | 40       |
| land    | 1     | 80  | recover: half squash                                         | 0    | 36 x 24    | 36       |
| death   | 0     | 100 | small recoil, closed eye, feet visible                       | 1    | 34 x 24    | 36       |
 | death | 1 | 120 | pronounced fall tilt, closed eye, visible tucked soles | 1 | 34 x 24 | 33 |
| death   | 2     | 80  | brief impact squash, rounded belly, feet hidden               | -2   | 38 x 16    | 39       |
| death   | 3     | 400 | spring to round sitting rest, soft contact ends, feet hidden | -2   | 34 x 21    | 39       |

Dash appends frames 18 to 20 after death, with 60, 130 and 60ms durations. The wing lifts up and back,
then recovers, while the head, torso and feet retain the rest pose. Its rounded tip and shoulder stay
inside the 48x42 frame. Dash plays once; gameplay selects it only during the active dash and restores
locomotion as soon as the dash ends. The 250ms art sequence matches the current configured burst.
Player collision remains the fixed 24x36 body; bird alpha is not registered for silhouette contact.

Lift is how far the body's bottom edge sits above its rest row, in pixels. Body w x h is the body's
superellipse; normal locomotion keeps its area within 2% of rest. Shadow w is for a ground shadow the game
may draw under him: the land contact frame's is the largest. flutter and jump 1 are airborne, so their shadow
is the game's to place. jump, land, death and dash play once and hold their last frame (the manifest's "once"); every
other tag loops. After land, play idle. Death is appended after the existing tags; frame indices stay fixed.
Death has no baked world movement: the runtime uses frame 0 for recoil, holds frame 1 during the physical fall,
then shows frame 2 on support and springs back to seated frame 3, held while the retry card is open.
The camera stays fixed. Durations above are art playback defaults; gameplay owns state timing and falling behaviour.
The death
impact briefly compresses the body; the final pose is a full, round sit with a short flat belly centre
and rounded contact ends, resting on the frame bottom. Feet show during recoil and fall, not on support.
The body-centre and frame-bottom anchor do not move.

States: idle idle; move walk, and in the air jump, flutter and land; react none, falls back to land (its squash
reads as a flinch); death death; talk none, falls back to idle (the portrait carries the speech); quirk none.

portrait-bird, 64x64: his head and the top of his body, facing right towards the text, cut off by the frame's
bottom edge, on a transparent ground (the dialogue box's 68x68 frame supplies the backing), with one ink outer
line. Tags: neutral (dot eye), happy (eye closed in an upward arc), worried (dot eye under a brow slanting down
to the back, the bill a little lower). One frame each.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from PIL import Image
from pixel import Grid, K

SRC = "art/bird"
W, H = 48, 42
BOX_W, BOX_H = 24, 36  # collision body
C = W / 2  # body centre x: the frame's centre line
BRX, BRY, POWER = 16.4, 13.0, 2.15  # body superellipse at rest
HEAD_R = 9.2  # head radius
NAPE_DROP = 3  # how far the body's top dips at the nape, below the back of his head, in px
BACK_FLAT = 2  # how far the middle of his back is pressed down, to soften its hump, in px
HEAD_X, HEAD_UP = 0.43, 0.62  # head centre: right of the body centre and above it, in body radii
BODY_BOTTOM = H - 3  # the body's bottom edge at rest; the feet fill the two rows under it
BASE, SHADE, LIGHT = "cream", "tan", "white"
WING = "tan"  # a flat patch, no line
OUTLINE = "dslate"


def cel(g, inside, base, sh, li, ks, kl):
    """Fill a shape cel-shaded from a top-left light: sh is a crescent ks px deep along the lower-right rim
    (pixels that leave the shape when moved ks px down and right), li a kl px rim on the upper left."""
    for y in range(g.h):
        for x in range(g.w):
            if inside(x, y):
                c = sh if not inside(x + ks, y + ks) else li if li and not inside(x - kl, y - kl) else base
                g.p(x, y, c)


def in_ell(cx, cy, rx, ry, ang=0.0):
    """Inside test for an ellipse rotated by ang radians."""
    ca, sa = math.cos(ang), math.sin(ang)

    def f(x, y):
        dx, dy = x + 0.5 - cx, y + 0.5 - cy
        u, v = dx * ca + dy * sa, -dx * sa + dy * ca
        return (u / rx) ** 2 + (v / ry) ** 2 <= 1

    return f


def in_body(cx, cy, rx, ry, nape_x, drop, flat):
    """His body: the superellipse with its top pressed down drop px at the nape (nape_x, where his back meets
    the back of his head), easing to nothing over 0.55 of the body's radius either side, so the head sits up
    above the back line; and pressed down flat px over the middle of his back, between the nape and the tail,
    so the back line is gentle rather than humped."""

    def ease(d, width):
        w = max(0.0, 1 - abs(d) / width)
        return w * w * (3 - 2 * w)

    def f(x, y):
        px = x + 0.5
        if y + 0.5 < cy:
            y = y - drop * ease(px - nape_x, rx * 0.55) - flat * ease(px - (cx - rx * 0.4), rx * 0.6)
        return (abs(px - cx) / rx) ** POWER + (abs(y + 0.5 - cy) / ry) ** POWER <= 1

    return f


def in_blob(cx, cy, rx, ry, power=POWER):
    return lambda x, y: (abs(x + 0.5 - cx) / rx) ** power + (abs(y + 0.5 - cy) / ry) ** power <= 1


def flat(g, inside, c):
    for y in range(g.h):
        for x in range(g.w):
            if inside(x, y):
                g.p(x, y, c)


def draw(lift=0, bw=BRX, bh=BRY, wing=("fold", 0), feet=((-5, 0), (2, 0)), eye="open", head_squash=1, seated=False):
    """One 48x42 frame.

    lift: body bottom edge this many px above its rest row. bw, bh: body radii. wing: ("fold", dy) or
    ("raise", degrees), the raised wing's direction in screen degrees (180 straight back, above 180 up and
    back). feet: ((dx, up), (dx, up)) for the far foot (drawn behind the body) and the near foot, each its left
    column relative to the body centre, or "tucked" (soles just under the belly), or "hidden" (no feet drawn).
    head_squash compresses the head vertically while retaining its bottom edge. Its default preserves the normal
    round head. seated rounds
    the lower belly into a short flat contact centre without visible feet.
    """
    g = Grid(W, H)
    bottom = BODY_BOTTOM - lift
    bcy = bottom - bh
    hcx, hcy = C + HEAD_X * BRX, bcy - HEAD_UP * bh
    hcy += HEAD_R * (1 - head_squash)
    head_ry = HEAD_R * head_squash

    def foot(i):
        dx, up = feet[i]
        g.rect(int(C + dx), H - 3 - up, 4, 2, "orange")

    if feet not in ("tucked", "hidden"):
        foot(0)
    # a short tail tip at the lowered rear, its root under the body
    cel(g, in_ell(C - bw + 1, bcy - 1, 4.4, 2.2, -0.45), BASE, SHADE, None, 1, 1)
    body = in_body(C, bcy, bw, bh, hcx - HEAD_R * 0.7, NAPE_DROP, BACK_FLAT)
    if seated:
        upper = body
        half_base = 7.5

        def body(x, y):
            if y + 0.5 < bcy:
                return upper(x, y)
            dx = max(0, abs(x + 0.5 - C) - half_base)
            return (dx / (bw - half_base)) ** 2 + ((y + 0.5 - bcy) / bh) ** 2 <= 1

    cel(g, body, BASE, SHADE, LIGHT, 3, 1)
    if feet == "tucked":
        for dx in (-5, 2):
            g.rect(int(C + dx), bottom, 4, 1, "orange")
    elif feet != "hidden":
        foot(1)
    kind, val = wing
    if kind == "raise":  # up and back from the top of his back, its root behind the head
        a = math.radians(val)
        # foreshortened as it comes down: 19px pointing up, 14px level
        ln = 14 + 5 * min(1.0, max(0.0, (val - 186) / 50))
        sx, sy = C - 5, bcy - bh * 0.45
        cel(
            g,
            in_ell(sx + math.cos(a) * ln * 0.5, sy + math.sin(a) * ln * 0.5, ln * 0.5, ln * 0.27, a),
            WING,
            "brown",
            None,
            1,
            1,
        )
    if kind == "dash":
        # The wing pivots from its shoulder while the head, torso and feet retain the rest pose.
        angle = (196, 218, 206)[val]
        length = (13, 20, 16)[val]
        a = math.radians(angle)
        sx, sy = C + 1, bcy + 1

        def wing_shape(x, y):
            dx, dy = x + 0.5 - sx, y + 0.5 - sy
            along = dx * math.cos(a) + dy * math.sin(a)
            across = -dx * math.sin(a) + dy * math.cos(a)
            if along < 0:
                return (along / 3) ** 2 + (across / 4) ** 2 <= 1
            taper = length - 2
            if along <= taper:
                return abs(across) <= 4 - 2 * along / taper
            return (along - taper) ** 2 + across**2 <= 4

        cel(g, wing_shape, WING, "brown", None, 1, 1)
    cel(g, in_ell(hcx, hcy, HEAD_R, head_ry), BASE, SHADE, LIGHT, 3, 1)
    if kind == "fold":  # on the body's side, its tip pointing back
        cel(g, in_ell(C - 2, bcy + 2 + val, BRX * 0.5, BRY * 0.3, -0.3), WING, "brown", None, 1, 1)
    g.rect(int(hcx + HEAD_R - 2), int(hcy), 7, round(5 * head_squash), "orange")  # bill
    g.rect(int(hcx + HEAD_R - 2), int(hcy) + round(5 * head_squash) - 1, 7, 1, "ochre")
    ey = int(hcy - head_ry * 0.55)
    if eye == "dead":
        # Ink is already the darkest palette colour; wider diagonal tips strengthen the death mark.
        for y, row in enumerate(("##.##", ".###.", "..#..", ".###.", "##.##")):
            for x, mark in enumerate(row):
                if mark == "#":
                    g.p(int(hcx) + x, ey + y, "ink")
    else:
        g.rect(int(hcx), ey if eye == "open" else ey + 2, 4, 4 if eye == "open" else 1, "ink")
    return g.outlined(lambda _c: K[OUTLINE])


# Squash and stretch: (bw, bh) keep bw * bh within 2% of the rest pose's 16.4 * 13.0 = 213.2.
SQUASH_CROUCH = (18.9, 11.2)
STRETCH_LIFT = (14.4, 14.8)
SQUASH_LAND = (19.6, 10.8)
SQUASH_RECOVER = (17.8, 11.9)


def falling_pose():
    """A pronounced clockwise tilt, with visible tucked soles and no baked world translation."""

    px = draw(lift=1, bw=17, bh=12, wing=("fold", 2), feet="tucked", eye="closed")
    im = Image.new("RGBA", (W, H))
    im.putdata([(*pixel.rgb(c), 255) if c else (0, 0, 0, 0) for row in px for c in row])
    im = im.rotate(-20, Image.Resampling.NEAREST, expand=False, center=(C, 29))
    return [
        ["{:02x}{:02x}{:02x}".format(*im.getpixel((x, y))[:3]) if im.getpixel((x, y))[3] else None for x in range(W)]
        for y in range(H)
    ]


def bird_tags():
    idle = [draw(), draw(lift=1, feet=((-5, -1), (2, -1)))]  # feet stay planted while the body rises
    walk = [
        draw(feet=((-7, 0), (4, 2))),
        draw(lift=1, feet=((-4, -1), (1, -1))),
        draw(feet=((4, 2), (-7, 0))),
        draw(lift=1, feet=((-4, -1), (1, -1))),
    ]
    jump = [
        draw(bw=SQUASH_CROUCH[0], bh=SQUASH_CROUCH[1], wing=("fold", -1), feet=((-6, 0), (3, 0))),
        draw(lift=3, bw=STRETCH_LIFT[0], bh=STRETCH_LIFT[1], wing=("raise", 206), feet="tucked"),
    ]
    # wing angles: up (the signature pose), back, level (the downstroke lifts the body 1px), back
    flutter = [draw(lift=2 + (a == 186), wing=("raise", a), feet="tucked") for a in (236, 212, 186, 212)]
    land = [
        draw(bw=SQUASH_LAND[0], bh=SQUASH_LAND[1], wing=("raise", 196), feet=((-8, 0), (5, 0))),
        draw(bw=SQUASH_RECOVER[0], bh=SQUASH_RECOVER[1], wing=("fold", -1), feet=((-6, 0), (3, 0))),
    ]
    return [
        ("idle", idle, 400),
        ("walk", walk, 130),
        ("jump", jump, [80, 100]),
        ("flutter", flutter, 100),
        ("land", land, [100, 80]),
        (
            "death",
            [
                draw(lift=1, bw=17, bh=12, wing=("fold", 2), eye="closed"),
                falling_pose(),
                draw(
                    lift=-2, bw=19, bh=8, wing=("fold", 2), feet="hidden", eye="closed", head_squash=0.82, seated=True
                ),
                draw(
                    lift=-2, bw=17, bh=10.5, wing=("fold", 2), feet="hidden", eye="dead", head_squash=0.95, seated=True
                ),
            ],
            [100, 120, 80, 400],
        ),
        ("dash", [draw(wing=("dash", phase)) for phase in range(3)], [60, 130, 60]),
    ]


def portrait(expr):
    """64x64: his head and the top of his body facing right, cut off by the bottom edge."""
    g = Grid(64, 64)
    hcx, hcy, hr = 30.0, 28.0, 19.0
    cel(g, in_blob(24, 64, 34, 22, 2.6), BASE, SHADE, LIGHT, 4, 1)  # the top of his body, the head set into it
    cel(g, in_ell(14, 56, 13, 5.5, -0.25), WING, "brown", None, 2, 1)
    cel(g, in_ell(hcx, hcy, hr, hr), BASE, SHADE, LIGHT, 4, 1)
    by = int(hcy + 1) + (2 if expr == "worried" else 0)
    g.rect(int(hcx + hr - 4), by, 13, 9, "orange")  # bill
    g.rect(int(hcx + hr - 4), by + 7, 13, 2, "ochre")
    ex, ey = int(hcx + 1), int(hcy - hr * 0.5)
    if expr == "happy":  # closed: an upward arc
        for i, dy in enumerate((4, 2, 1, 0, 0, 1, 2, 4)):
            g.rect(ex - 1 + i, ey + 1 + dy, 1, 2, "ink")
    else:
        g.rect(ex, ey, 7, 7, "ink")
        if expr == "worried":  # brow slanting down to the back
            for i in range(8):
                g.rect(ex - 2 + i, ey - 5 + (7 - i) // 3, 1, 2, "ink")
    return g.outlined(lambda _c: K["ink"])


def portrait_tags():
    return [(e, [portrait(e)], 1000) for e in ("neutral", "happy", "worried")]


def sprites():
    yield "bird", bird_tags()
    yield "portrait-bird", portrait_tags()


# Tags that play once and hold their last frame; every other tag loops.
ONCE = {"bird": ("jump", "land", "death", "dash")}


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, once=ONCE)
