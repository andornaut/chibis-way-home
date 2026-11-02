"""UI art: the dialogue box, choices, quip strip, touch buttons, start screen and cards, at the 720x360 base resolution.

Usage:
  ui.py build             write art/ui/<key>.aseprite and public/art/sprites/<key>.png + .json, list them in the
                          manifest
  ui.py preview OUT.png   a contact sheet of every frame

Run from the repository root. Text is never baked in: the game sets it with font-body or font-title at 2x. A text
origin below is a BitmapText's top-left at scale 2, and A is the text's advance width at 2x (the sum of xadvance,
doubled). Positions are in base pixels, top-left of the frame, matching the layout in art/README.md.

Nine-slice textures carry their margins (left, top, right, bottom) as an Aseprite slice named after the key and as
"slice" in the manifest entry. Single-state art has one tag, "rest", at 100ms. The touch buttons' press tag
plays once and holds its last frame (the manifest's "once") until the game shows the held tag; every other tag
loops.

Dialogue
- ui-dialogue-box, 640x96, at 40,256. Navy, ink border with cut corners, slate rim top-left, dslate bottom-right.
  Body text cream, origin 128,268, 504 wide, lines every 20.
- ui-portrait-frame, 68x68, at 48,270. Recessed dslate well; the 64px portrait goes at 50,272.
- ui-name-tab, nine-slice 12x20, margins 2,2,2,2; tags amber, green, pink, tan (the fill; one per speaker). Drawn
  A+12 wide at 124,237, so its bottom row lies on the box's top border. Name ink, origin x+6, y 234.
- ui-forward-mark, 10x14, at 653,323 (centred in the 636,308,44,44 hit area). Tag idle: the triangle steps right
  0, 2, 3, 2px over 1800, 80, 160, 80ms. Reduced motion shows frame 0.
- ui-skip, 78x20, at 634,8 (hit 634,8,78,44). Tags normal, pressed (dslate, rim inverted), disabled (flat, no
  rim, the double chevron becomes a bar). Label SKIP origin 643,5: cream, or grey when disabled.
- ui-answer, 208x36, hit 208x44 from row top y 192, so the art sits at y 196, 8 apart. Three at x 40, 256, 472
  (spanning the box); two at x 148, 364. Tags normal (dslate), selected (cream with an ink cursor), pressed (tan
  with the cursor). Text origin x+19, y 205, at most 166 wide: cream when normal, ink otherwise.

Quip
- ui-quip-strip, nine-slice 12x24, margins 2,2,2,2. Drawn An+Ab+24 wide (An the name, Ab the line), at most 452,
  centred on x 360 at y 8 (within 138..590). Name in font-title in the speaker's tab colour, origin x+9, y 7;
  line cream in font-body, origin x+15+An, y 11.

Touch controls (two round buttons for the right thumb, a pause button at the top left and the move hint at the left)
- Positions here are the base 720x360 layout as drawn. At runtime the game keeps every control inside the game's
  view across, ui-pause at the view's top and Use, Jump and the move hint at the screen's bottom, and sizes their
  press areas (src/layout/hitAreas.ts). Each drawn edge sits at least 8px from the edge it is placed against.
  Jump's ring is 8px in from the right and 20px up from the bottom, and the pause disc 8px in from the top and left.
- ui-touch-use, 75x75, centre pixel 37,37: top-left 561,166 for the centre 598,203.
- ui-touch-jump, 75x75, centre pixel 37,37: top-left 638,266 for the centre 675,303, towards the bottom-right
  corner, with Use above and to its left.
- Each is the move hint's open ring, 73px across with no face: a 2px cream band between 1px ink lines, with its icon
  centred in 2px strokes and fringed in ink, so it reads on any ground: three round dots (25x7) on Use, their top
  3px above the centre, and a caret (21x11) on Jump, its top 5px above. No label. Tags rest (100ms); press, once
  (frame 0 the band and icon turn white and the ring swells 1px; frame 1 the same at rest size; 60ms each); held (as
  press frame 1, 100ms).
- ui-pause, 35x35, centre pixel 17,17: top-left 7,7 for the centre 24,24, its disc 8px in from the top and left. A
disc 33px
  across: an ink edge, a 2px cream ring (3px pressed) and a navy face (dslate pressed), with two pause bars (11x13,
  each 4 wide, 3 apart) centred on the centre; no label. Tags as for Use and Jump: rest; press, once (2 frames at
  60ms, frame 0 swells 1px); held.
- ui-move-hint, 75x75, centre pixel 37,37: a drawing only, with no press area. An open ring 73px across with no
  face, a 2px cream band between 1px ink lines, and a 2x chevron (8x10) each side, 22px from the centre, fringed in
  ink, so it reads on any ground, sky, character or prop. At rest its centre is level with Jump's and its ring as far
  in from the view's left as Use's is from its right: centre 121,303 (top-left 84,266) at 720 wide.
  While a touch moves her, the game draws it centred on that touch's neutral point (where the drag began), anywhere
  on screen, and puts it back on release. Tags rest; held-left and held-right (the dragged side's chevron white);
  one frame each.
- ui-move-knob, 11x11, centre pixel 5,5: a 9px knob fringed in ink, drawn on the hint's centre and offset by the
  drag's distance from its neutral point, left or right, capped at 12px. Tags rest (cream), held (white).

Button labels
- Every button's label is font-body at 2x, mixed case ("Start", "Resume", "Continue", "Install"), set by the game.
  It is centred on the button: origin x = the button's centre x - floor(ink width / 2), where the ink width is the
  label's visible width (advance - 2). Start, Resume and Continue lead with ui-play-mark: the mark, a 6px gap and
  the label's ink are centred as one group by the same rule, the mark at the group's x and the label's origin 11 to
  its right. Origin y is fixed per button, below; the label and the mark sink 2px while pressed.
- ui-play-mark, 5x10: rest is ink for pale/green faces; light is cream for dark primary faces.
  Both static 100ms tags share the same triangle, its top 4 rows below the label's origin y.

Start screen (720x360, over the street)
- ui-nav-bar, nine-slice 12x48, margins 1,1,1,3: a navy band ending in a slate line over an ink line, drawn
  720x48 at 0,0.
- ui-icon-button, 36x36, tags normal and pressed (the face sinks 2px): an ink line with cut corners, a dslate face
  with a slate top highlight on a navy lip. Its 20x20 icon goes at button + (8,6), or (8,8) pressed. With Exit:
  Settings at 632,6 (hit 628,2,44,44, icon 640,12) and Exit at 676,6 (hit 672,2,44,44, icon 684,12). Without Exit
  (Firefox for Android's installed app): Settings at 676,6 (hit 672,2,44,44, icon 684,12).
- Nav icons, 20x20: icon-settings-nav (the cog), ui-quit's normal frame (Exit: the doorway and arrow) and
  icon-home-nav (the house).
- ui-start, 192x52, tags normal and pressed: Resume's green button, larger. With the logo (public/art/logo.png at
  180,60) Start sits at 264,268; without it at 264,178. Label origin y = Start's y + 15, ui-play-mark's top y + 19:
  "Start" puts the triangle at x 338 and the label at 349.

Pause card, settings card and install steps card (each over the game dimmed two ramp steps, one at a time)
- ui-settings-card, nine-slice 16x16, margins 2,2,2,2: an ink border with cut corners round an lgrey face (pale
  steel), a white rim on the top and left and a grey rim on the bottom and right; no header. Every card is
  drawn 368 wide at 176,88. Title ink in font-title (11.0:1 on lgrey), centred on x 360: origin x = 358 minus
  floor((A - 4) / 2), where A is its advance width at 2x, origin y 96.
- ui-close, 24x24, at 510,94 (hit 500,88,44,44), the card's top right, on every card. Tags normal (ink X), pressed
  (white X on dslate).
- A settings row has no art, as on dog-walker-game's settings card: a 352x48 hit area at x 184 holding its 16x16
  icon at 198,y+16, its label (font-body, ink) at origin 228,y+15 and, for a toggle, ui-switch at 496,y+16.
- Pause card, 368x236, title "Paused": three buttons 352x48 at x 184, 4 apart: Resume (ui-button-primary) at y 136,
  Settings at y 188 and Back to title at y 240 (ui-button). Labels centred, origin y = button y + 13.
- Settings card, title "Settings": 368x236 with the Install row, 368x184 without it. Rows: "Move controls" at
  y 136 (icon-move-controls) and "Action buttons" at y 188 (icon-touch-controls), each with ui-switch, both on by
  default; Install at y 240, only while the app is installable (icon-install; ui-button drawn 72x28 at 452,250,
  centred on x 488, label ink, origin y 253; room 56). The build label, dslate in font-body (5.83:1 on lgrey), for
  example "v0.0.1 · dev", is centred on x 360 with its origin 28 above the card's foot: y 296, or 244 without
  Install.
- Install steps card, 368x160, title "Install". Two steps, each a 16x16 glyph and up to two lines of ink
  font-body at a 20px pitch, room 296: step 1's glyph (icon-ios-share on iOS, icon-browser-menu where the browser
  installs from its menu) at 198,145, text origin 228,144; step 2's glyph (icon-install) at 198,197, text origin
  228,196.
- ui-focus, nine-slice 16x16, margins 4,4,4,4: the keyboard focus ring, a 2px yellow band between 1px ink lines with
  cut corners. Draw it at (x-4, y-4, w+8, h+8) round the focused element's hit area or face: a row (360x56, the
  Install row included), Resume (168x52), Start (200x60), an answer (216x44), a nav button (44x44) or the close
  X's 24x24 mark (32x32). One tag, rest.
- ui-switch, 32x16, dog-walker-game's switch: an ink-rimmed track with a white knob, at the right with a white tick
  on dgreen when on, at the left with a white cross on slate when off, so the state reads by knob side and glyph as
  well as colour. Tags on, off.
- ui-quit, 20x20: the doorway with an arrow leaving it, the nav's Exit icon. Tags normal (cream), pressed (white,
  the arrow 2px further out).
- ui-button, nine-slice 16x28, margins 2,4,2,6: the secondary button, dog-walker-game's shape with no outline and
  cut corners: a grey face, one step darker than the card, with an lgrey highlight on its top row and a slate lip
  4px deep. Label ink (6.39:1 on grey). Tags normal, pressed (the face sinks 2px and the lip is gone, so its label
  moves down 2). The appended disabled tag keeps normal alpha geometry with one flat opaque lgrey fill.
- ui-button-primary, nine-slice 16x28, margins 2,4,2,6: the primary button, ui-button's geometry, tags and press in
  dark steel: a dslate face, a slate highlight and a navy lip. Label white (9.55:1 on dslate). Its appended
  disabled tag matches ui-button's flat lgrey face; runtime disabled labels use dslate.
- 16x16 row icons, one tag, rest: icon-settings (a cog: four 4x2 teeth on the axes and four 2x2 on the diagonals
  round a ring with a round hole), icon-home (dog-walker's solid house: a 1:1 pitched roof, a chimney on the right
  slope and a door gap, filled dslate), icon-exit (ui-quit's doorway and arrow, 12 rows
  tall), icon-touch-controls (a round touch button with the Jump caret), icon-install (an arrow down into a tray),
  icon-ios-share (Safari's Share button), icon-browser-menu (three stacked dots) and icon-move-controls (the move
  hint in small: a round ring with a chevron each side). All are flat dslate; line icons use2px strokes (5.83:1
  on the card's lgrey).
- ui-resume, 160x44: a green button with the play mark, the map's Continue at 280,300 (the hit area; art/tools/map.py
  places its label). Tags normal, pressed (the face sinks 2px into its lip).
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from pixel import Grid, darker

SRC = "art/ui"

# Name tab fills, one tag each: hues the panels do not use. Ink text holds at least 6.6:1 on each, and each
# holds at least 5:1 as text on the navy panels, so the quip strip sets the speaker's name in the same colour.
TAB_FILLS = ("amber", "green", "pink", "tan")


def bm(*rows):
    """A bitmap from strings: '#' is set."""
    return [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "#"]


def stamp(g, pts, x, y, c):
    for px, py in pts:
        g.p(x + px, y + py, c)


def panel(g, x, y, w, h, fill, rim=("slate", "dslate"), border="ink"):
    """A box: a 1px border with cut corners, and a 1px rim inside it (the first colour on the top and left, the
    second on the bottom and right)."""
    g.rect(x, y, w, h, border)
    for cx, cy in ((x, y), (x + w - 1, y), (x, y + h - 1), (x + w - 1, y + h - 1)):
        g.p(cx, cy, None)
    g.rect(x + 1, y + 1, w - 2, h - 2, fill)
    if rim:
        lt, rb = rim
        if lt:
            g.rect(x + 1, y + 1, w - 2, 1, lt)
            g.rect(x + 1, y + 1, 1, h - 2, lt)
        if rb:
            g.rect(x + 1, y + h - 2, w - 2, 1, rb)
            g.rect(x + w - 2, y + 2, 1, h - 3, rb)


def tri_right(g, x, y, h, c):
    """A right-pointing triangle h tall (even), stepping 1px per column: h/2 wide."""
    for i in range(h // 2):
        g.rect(x + i, y + i, 1, h - 2 * i, c)


# ---------------------------------------------------------------- dialogue


def dialogue_box():
    g = Grid(640, 96)
    panel(g, 0, 0, 640, 96, "navy")
    return g.px


def portrait_frame():
    """Recessed: the shade on the top and left, the light on the bottom and right."""
    g = Grid(68, 68)
    panel(g, 0, 0, 68, 68, "dslate", rim=("navy", "slate"))
    return g.px


def name_tab(fill):
    g = Grid(12, 20)
    panel(g, 0, 0, 12, 20, fill, rim=(None, darker(fill)))
    return g.px


FORWARD_STEPS = ((0, 1800), (2, 80), (3, 160), (2, 80))  # (x offset, ms)


def forward_mark():
    frames = []
    for dx, _ in FORWARD_STEPS:
        g = Grid(10, 14)
        tri_right(g, dx, 0, 14, "cream")
        frames.append(g.px)
    return frames


def skip(state):
    """78x20. Label glyphs at 11..48, the double chevron at 55..66."""
    g = Grid(78, 20)
    if state == "disabled":
        panel(g, 0, 0, 78, 20, "navy", rim=None)
        g.rect(55, 9, 12, 2, "grey")
    else:
        rim = ("slate", "dslate") if state == "normal" else ("ink", "slate")
        panel(g, 0, 0, 78, 20, "navy" if state == "normal" else "dslate", rim=rim)
        for x in (55, 62):
            tri_right(g, x, 5, 10, "cream")
    return g.px


def answer(state):
    """208x36. Text from x 19; the cursor at 7..13."""
    g = Grid(208, 36)
    if state == "normal":
        panel(g, 0, 0, 208, 36, "dslate", rim=("slate", "navy"))
    else:
        fill = "cream" if state == "selected" else "tan"
        rim = ("white", "tan") if state == "selected" else ("brown", "cream")
        panel(g, 0, 0, 208, 36, fill, rim=rim)
        tri_right(g, 7, 11, 14, "ink")
    return g.px


def quip_strip():
    g = Grid(12, 24)
    panel(g, 0, 0, 12, 24, "navy")
    return g.px


# ---------------------------------------------------------------- touch controls

BUTTON_R = {"use": 36, "jump": 36, "pause": 16}  # disc radius: 73, 73 and 33px across
RING_W = {"pause": 2}  # the pause disc's cream ring at rest; pressed, it thickens 1px
CARET = [(x, y) for y in range(11) for x in (10 - y, 11 - y, 9 + y, 10 + y)]  # 21x11, 2px strokes
DOT = bm("..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###..")
DOTS = [(x + i * 9, y) for i in range(3) for x, y in DOT]  # 25x7
BARS = [(x + i * 7, y) for i in range(2) for x in range(4) for y in range(13)]  # 11x13, two pause bars
ICON = {"use": (DOTS, -3), "jump": (CARET, -5), "pause": (BARS, -6)}  # bitmap, top row relative to the centre


def disc(g, cx, cy, r, c):
    for y in range(g.h):
        for x in range(g.w):
            if (x - cx) ** 2 + (y - cy) ** 2 <= (r + 0.5) ** 2:
                g.p(x, y, c)


def touch_button_frame(key, frame=None):
    """frame None is rest; 0 and 1 the press; 2 held. Use and Jump are the move hint's open ring with the icon
    fringed in ink and centred; ui-pause is a disc. Pressed, the band and icon turn white; frame 0 swells the ring or
    disc 1px. The pause disc's ring also thickens 1px and its face lifts to dslate."""
    r = BUTTON_R[key] + (1 if frame == 0 else 0)
    c = BUTTON_R[key] + 1
    hot = frame is not None
    band = "white" if hot else "cream"
    g = Grid(2 * c + 1, 2 * c + 1)
    pts, top = ICON[key]
    w = max(x for x, _ in pts) + 1
    if key == "pause":
        disc(g, c, c, r, "ink")
        disc(g, c, c, r - 1, band)
        disc(g, c, c, r - 1 - RING_W[key] - (1 if hot else 0), "dslate" if hot else "navy")
        stamp(g, pts, c - w // 2, c + top, band)
        return g.px
    for y in range(g.h):
        for x in range(g.w):
            d = math.hypot(x - c, y - c)
            if r - 3.5 < d <= r + 0.5:
                g.p(x, y, "ink" if d > r - 0.5 or d <= r - 2.5 else band)
    marks = Grid(g.w, g.h)
    stamp(marks, pts, c - w // 2, c + top, band)
    fringed(g, marks)
    return g.px


def touch_button(key):
    return [
        ("rest", [touch_button_frame(key)], 100),
        ("press", [touch_button_frame(key, 0), touch_button_frame(key, 1)], 60),
        ("held", [touch_button_frame(key, 2)], 100),
    ]


# ---------------------------------------------------------------- settings


def settings_card():
    """16x16 nine-slice: an ink border with cut corners round an lgrey face (pale steel), lit top-left: a white rim
    on the top and left, a grey rim on the bottom and right. No header."""
    g = Grid(16, 16)
    panel(g, 0, 0, 16, 16, "lgrey", rim=("white", "grey"))
    return g.px


def resume(state):
    """160x44: an ink border, a green face and a dark green lip 4px deep; pressed, the face sinks 2px into it. No
    triangle or label is drawn in: the game draws ui-play-mark and the label, centred as one group."""
    top = 0 if state == "normal" else 2
    g = Grid(160, 44)
    panel(g, 0, top, 160, 44 - top, "dgreen", rim=None)
    g.rect(1, top + 1, 158, 38, "green")
    return g.px


X = (
    [(i, i) for i in range(12)]
    + [(i + 1, i) for i in range(11)]
    + [(11 - i, i) for i in range(12)]
    + [(10 - i, i) for i in range(11)]
)


def plate(face, lip, hi, state):
    """16x28 nine-slice, the dog-walker-game button: no outline, cut corners, a face with a 1px highlight on its top
    row and a lip 4px deep; pressed, the face sinks 2px and the lip is gone."""
    if state == "disabled":
        face = lip = hi = "lgrey"
        state = "normal"
    g = Grid(16, 28)
    top = 0 if state == "normal" else 2
    if not top:
        g.rect(1, 24, 14, 4, lip)
        g.rect(0, 24, 16, 3, lip)
    g.rect(1, top, 14, 24, face)
    g.rect(0, top + 1, 16, 22, face)
    g.rect(2, top + 1, 12, 1, hi)
    return g.px


def button(state):
    """The secondary button: a grey face, an lgrey highlight and a slate lip, one step darker than the card."""
    return plate("grey", "slate", "lgrey", state)


def button_primary(state):
    """The primary button: a dslate face, a slate highlight and a navy lip."""
    return plate("dslate", "navy", "slate", state)


def switch(on):
    """32x16, dog-walker-game's switch on the card: an ink-rimmed track, the white knob at the right and a white tick
    on dgreen when on, at the left with a white cross on slate when off."""
    track, sh = ("dgreen", "forest") if on else ("slate", "dslate")
    g = Grid(32, 16)
    for dy in range(16):
        inset = round(8 - (64 - (dy - 7.5) ** 2) ** 0.5) if abs(dy - 7.5) < 8 else 8
        g.rect(inset, dy, 32 - 2 * inset, 1, "ink")
        if 0 < dy < 15:
            inner = round(8 - (49 - (dy - 7.5) ** 2) ** 0.5) if abs(dy - 7.5) < 7 else 8
            g.rect(inner + 1, dy, 30 - 2 * inner, 1, sh if dy == 1 else track)
    kx = 23.5 if on else 8.5
    g.ell(kx, 8, 6, 6, "ink")
    g.ell(kx, 8, 5, 5, "white", "lgrey")
    if on:
        for x, y in ((4, 8), (5, 9), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5)):
            g.rect(x, y, 1, 2, "white")
    else:
        for i in range(5):
            g.rect(19 + i, 5 + i, 1, 2, "white")
            g.rect(23 - i, 5 + i, 1, 2, "white")
    return g.px


def icon(rows):
    """A 16x16 icon from 16 strings ('#' is ROW_ICON): flat, 2px strokes."""
    g = Grid(16, 16)
    stamp(g, bm(*rows), 0, 0, ROW_ICON)
    return g.px


ROW_ICON = "dslate"  # 16x16 icons sit on the card's lgrey face: 5.83:1
DOT4 = (".##.", "####", "####", ".##.")
ICONS = {
    # a cog: a ring round a hole, four 4x2 teeth on the axes and four 2x2 on the diagonals
    "icon-settings": [
        "......####......",
        "......####......",
        "..##..####..##..",
        "..############..",
        "...##########...",
        "...####..####...",
        "######....######",
        "#####......#####",
        "#####......#####",
        "######....######",
        "...####..####...",
        "...##########...",
        "..############..",
        "..##..####..##..",
        "......####......",
        "......####......",
    ],
    # a down arrow into a tray
    "icon-install": [
        ".......##.......",
        ".......##.......",
        ".......##.......",
        ".......##.......",
        "...##..##..##...",
        "....##.##.##....",
        ".....######.....",
        "......####......",
        ".......##.......",
        "................",
        "##............##",
        "##............##",
        "##............##",
        "##............##",
        "################",
        "################",
    ],
    # Safari's Share button: a box open at the top with an arrow rising out of it
    "icon-ios-share": [
        ".......##.......",
        "......####......",
        ".....##..##.....",
        "....##.##.##....",
        ".......##.......",
        ".......##.......",
        "..####.##.####..",
        "..##...##...##..",
        "..##...##...##..",
        "..##...##...##..",
        "..##........##..",
        "..##........##..",
        "..##........##..",
        "..##........##..",
        "..############..",
        "..############..",
    ],
    # the browser menu button: three round dots stacked on the centre line
    "icon-browser-menu": ["......" + r + "......" for r in DOT4]
    + ["................"] * 2
    + ["......" + r + "......" for r in DOT4]
    + ["................"] * 2
    + ["......" + r + "......" for r in DOT4],
}


MOVE_R = 36  # ui-move-hint's ring: 73 across, like Use and Jump
CHEVRON_2X = ["..##", ".##.", "##..", ".##.", "..##"]  # a 4x5 design at 2x: 8x10, pointing left


def fringed(g, marks):
    """Stamp marks (a Grid of fills) onto g with a 1px ink fringe round them, so they hold on any ground."""
    n_h, n_w = len(marks.px), len(marks.px[0])
    for y in range(n_h):
        for x in range(n_w):
            if marks.px[y][x]:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < n_w and 0 <= yy < n_h and not marks.px[yy][xx]:
                        g.p(xx, yy, "ink")
    for y in range(n_h):
        for x in range(n_w):
            if marks.px[y][x]:
                g.p(x, y, marks.px[y][x])


def move_hint(lit=0):
    """75x75, centre pixel 37,37: an open ring with no face, a 2px cream band between 1px ink lines, and a 2x chevron
    each side with an ink fringe. lit is the dragged side (-1 left, 1 right), whose chevron turns white."""
    n = 2 * (MOVE_R + 1) + 1
    c = n // 2
    g = Grid(n, n)
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c)
            if MOVE_R - 3.5 < d <= MOVE_R + 0.5:
                g.p(x, y, "ink" if d > MOVE_R - 0.5 or d <= MOVE_R - 2.5 else "cream")
    marks = Grid(n, n)
    for side in (-1, 1):
        for y, row in enumerate(CHEVRON_2X):
            for x, ch in enumerate(row):
                if ch == "#":
                    xx = 3 - x if side > 0 else x
                    marks.rect(c + side * 22 - 4 + xx * 2, c - 5 + y * 2, 2, 2, "white" if side == lit else "cream")
    fringed(g, marks)
    return g.px


def move_knob(held):
    """11x11, centre pixel 5,5: a round 9px knob (cream at rest, white while held) with an ink fringe."""
    g = Grid(11, 11)
    marks = Grid(11, 11)
    disc(marks, 5, 5, 4, "white" if held else "cream")
    fringed(g, marks)
    return g.px


def move_controls_icon():
    """icon-move-controls, 16x16: the move hint in small, a round 2px ring with a chevron each side."""
    g = Grid(16, 16)
    for y in range(16):
        for x in range(16):
            if 5.9 <= math.hypot(x - 7.5, y - 7.5) <= 7.9:
                g.p(x, y, ROW_ICON)
    for x, y in ((5, 5), (4, 6), (3, 7), (3, 8), (4, 9), (5, 10)):
        g.rect(x, y, 2, 1, ROW_ICON)
        g.rect(14 - x, y, 2, 1, ROW_ICON)
    return g.px


def touch_controls_icon():
    """A touch button: a round 2px ring with the Jump caret (2px strokes) inside, centred on the frame."""
    g = Grid(16, 16)
    for y in range(16):
        for x in range(16):
            if 5.9 <= math.hypot(x - 7.5, y - 7.5) <= 7.9:
                g.p(x, y, ROW_ICON)
    g.rect(7, 6, 2, 1, ROW_ICON)
    for i in range(3):
        g.rect(6 - i, 7 + i, 2, 1, ROW_ICON)
        g.rect(8 + i, 7 + i, 2, 1, ROW_ICON)
    return g.px


def focus():
    """16x16 nine-slice, margins 4: the keyboard focus ring. From the outside in: a 1px ink fringe, a 2px yellow
    band and a 1px ink line, with cut corners, and a clear centre. Drawn 4px outside the element on every side, so
    the yellow band sits 2 to 3px outside its edge and the ink holds it apart from any fill on either side."""
    g = Grid(16, 16)
    for k, c in ((0, "ink"), (1, "yellow"), (3, "ink")):
        w = 16 - 2 * k
        g.rect(k, k, w, w, c)
        for cx, cy in ((k, k), (k + w - 1, k), (k, k + w - 1), (k + w - 1, k + w - 1)):
            g.p(cx, cy, None if k == 0 else ("ink" if k == 1 else "yellow"))
    g.rect(4, 4, 8, 8, None)
    return g.px


# The nav and row icons share their shapes with dog-walker-game's: the cog (icon-settings), the doorway with an arrow
# leaving it (ui-quit, and icon-exit at 16), and a solid house with a chimney on the right slope and a door gap
# (dog-walker's home_icon()), cream with tan on its lower-right edges.

EXIT_16 = [
    ".#########......",
    ".#########......",
    ".##.....##..#...",
    ".##.....##..##..",
    ".##.........###.",
    ".##...##########",
    ".##...##########",
    ".##.........###.",
    ".##.....##..##..",
    ".##.....##..#...",
    ".#########......",
    ".#########......",
]
# a is fill, o the shade on the lower-right edges
HOME_16 = [
    ".....aa.ao..",
    "....aaaaao..",
    "...aaaaaao..",
    "..aaaaaaao..",
    ".aaaaaaaaao.",
    "aaaaaaaaaaao",
    "..aaaaaaao..",
    "..aaa..aao..",
    "..aaa..aao..",
    "..ooo..ooo..",
]
HOME_20 = [
    "......aa.ao...",
    ".....aaaaao...",
    "....aaaaaao...",
    "...aaaaaaao...",
    "..aaaaaaaaao..",
    ".aaaaaaaaaaao.",
    "aaaaaaaaaaaaao",
    "..aaaaaaaaao..",
    "..aaaaaaaaao..",
    "..aaaa..aaao..",
    "..aaaa..aaao..",
    "..aaaa..aaao..",
    "..oooo..oooo..",
]


def home(n):
    """A solid house, centred: a 1:1 pitched roof with a chimney on the right slope and a door gap at the foot,
    dslate on pale cards, cream/tan on dark navigation. 12x10 in a16x16 frame, 14x13 in a20x20 one."""
    rows = HOME_16 if n == 16 else HOME_20
    g = Grid(n, n)
    x0, y0 = (n - len(rows[0])) // 2, (n - len(rows)) // 2
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(x0 + x, y0 + y, ROW_ICON if n == 16 else "cream" if ch == "a" else "tan")
    return g.px


def exit_16():
    """icon-exit, ui-quit's doorway and arrow at 16x16: 2px strokes, 12 rows tall, centred."""
    g = Grid(16, 16)
    stamp(g, bm(*EXIT_16), 0, 2, ROW_ICON)
    return g.px


def cog_20():
    """icon-settings-nav, the cog at 20x20: a 4px-wide tooth on each axis, a 3x3 tooth on each diagonal, a ring
    and a round hole."""
    g = Grid(20, 20)
    for y in range(20):
        for x in range(20):
            dx, dy = abs(x + 0.5 - 10), abs(y + 0.5 - 10)
            r = math.hypot(dx, dy)
            diag = 5.5 <= dx <= 7.5 and 5.5 <= dy <= 7.5
            if r > 3.6 and (r <= 7.2 or min(dx, dy) <= 1.5 or diag):
                g.p(x, y, "cream")
    return g.px


def icon_button(state):
    """36x36: a nav button for a 20x20 icon at 8,6 (8,8 pressed). An ink line with cut corners, a dslate face with
    a slate top highlight on a navy lip 4px deep; pressed, the face sinks 2px."""
    top = 0 if state == "normal" else 2
    g = Grid(36, 36)
    panel(g, 0, top, 36, 36 - top, "navy", rim=None)
    g.rect(1, top + 1, 34, 30, "dslate")
    if state == "normal":
        g.rect(2, 1, 32, 1, "slate")
    return g.px


def nav_bar():
    """12x48 nine-slice, margins 1,1,1,3: a navy band ending in a slate line over an ink line."""
    g = Grid(12, 48)
    g.rect(0, 0, 12, 46, "navy")
    g.rect(0, 46, 12, 1, "slate")
    g.rect(0, 47, 12, 1, "ink")
    return g.px


def start(state):
    """192x52: Resume's green button at the start screen's size, with no triangle or label drawn in: the game draws
    ui-play-mark and the label, centred as one group."""
    top = 0 if state == "normal" else 2
    g = Grid(192, 52)
    panel(g, 0, top, 192, 52 - top, "dgreen", rim=None)
    g.rect(1, top + 1, 190, 46, "green")
    return g.px


def play_icon(colour="ink"):
    """5x10: the same triangle in ink for pale/green faces or cream for dark primary faces."""
    g = Grid(5, 10)
    tri_right(g, 0, 0, 10, colour)
    return g.px


def quit_icon(state):
    """20x20: a doorway (2px strokes, open on the right) with an arrow leaving through it. Pressed, the arrow
    steps 2px further out and turns white."""
    c, dx = ("white", 2) if state == "pressed" else ("cream", 0)
    g = Grid(20, 20)
    g.rect(1, 1, 12, 2, c)
    g.rect(1, 17, 12, 2, c)
    g.rect(1, 1, 2, 18, c)
    g.rect(11, 1, 2, 5, c)
    g.rect(11, 14, 2, 5, c)
    g.rect(6 + dx, 9, 7, 2, c)
    tri_right(g, 13 + dx, 5, 10, c)
    return g.px


def close(state):
    g = Grid(24, 24)
    if state == "pressed":
        panel(g, 0, 0, 24, 24, "dslate", rim=None, border="dslate")
    stamp(g, X, 6, 6, "white" if state == "pressed" else "ink")
    return g.px


# ---------------------------------------------------------------- the set

SLICES = {
    "ui-name-tab": (2, 2, 2, 2),
    "ui-nav-bar": (1, 1, 1, 3),
    "ui-button": (2, 4, 2, 6),
    "ui-button-primary": (2, 4, 2, 6),
    "ui-focus": (4, 4, 4, 4),
    "ui-quip-strip": (2, 2, 2, 2),
    "ui-settings-card": (2, 2, 2, 2),
}


# Tags that play once and hold their last frame; every other tag loops.
ONCE = {
    "ui-pause": ("press",),
    "ui-touch-jump": ("press",),
    "ui-touch-use": ("press",),
}


def sprites():
    one = lambda frame, tag="rest": [(tag, [frame], 100)]  # noqa: E731
    for key in sorted(ICONS):
        yield key, one(icon(ICONS[key]))
    yield "icon-exit", one(exit_16())
    yield "icon-home", one(home(16))
    yield "icon-home-nav", one(home(20))
    yield "icon-settings-nav", one(cog_20())
    yield "icon-move-controls", one(move_controls_icon())
    yield "icon-touch-controls", one(touch_controls_icon())
    yield "ui-answer", [(s, [answer(s)], 100) for s in ("normal", "selected", "pressed")]
    yield "ui-button", [(s, [button(s)], 100) for s in ("normal", "pressed", "disabled")]
    yield "ui-button-primary", [(s, [button_primary(s)], 100) for s in ("normal", "pressed", "disabled")]
    yield "ui-switch", [(s, [switch(s == "on")], 100) for s in ("on", "off")]
    yield "ui-close", [(s, [close(s)], 100) for s in ("normal", "pressed")]
    yield "ui-dialogue-box", one(dialogue_box())
    yield "ui-focus", one(focus())
    yield "ui-icon-button", [(s, [icon_button(s)], 100) for s in ("normal", "pressed")]
    yield "ui-forward-mark", [("idle", forward_mark(), [ms for _, ms in FORWARD_STEPS])]
    yield (
        "ui-move-hint",
        [("rest", [move_hint()], 100), ("held-left", [move_hint(-1)], 100), ("held-right", [move_hint(1)], 100)],
    )
    yield "ui-move-knob", [("rest", [move_knob(False)], 100), ("held", [move_knob(True)], 100)]
    yield "ui-name-tab", [(c, [name_tab(c)], 100) for c in TAB_FILLS]
    yield "ui-nav-bar", one(nav_bar())
    yield "ui-pause", touch_button("pause")
    yield "ui-play-mark", [("rest", [play_icon()], 100), ("light", [play_icon("cream")], 100)]
    yield "ui-portrait-frame", one(portrait_frame())
    yield "ui-quit", [(s, [quit_icon(s)], 100) for s in ("normal", "pressed")]
    yield "ui-quip-strip", one(quip_strip())
    yield "ui-resume", [(s, [resume(s)], 100) for s in ("normal", "pressed")]
    yield "ui-settings-card", one(settings_card())
    yield "ui-start", [(s, [start(s)], 100) for s in ("normal", "pressed")]
    yield "ui-skip", [(s, [skip(s)], 100) for s in ("normal", "pressed", "disabled")]
    yield "ui-touch-jump", touch_button("jump")
    yield "ui-touch-use", touch_button("use")


if __name__ == "__main__":
    pixel.main(sys.argv, sprites, SRC, __doc__, slices=SLICES, once=ONCE)
