/**
 * UI art: the dialogue box, touch buttons, start screen and cards, at the 720x360 base resolution.
 *
 * Usage:
 *   node art/tools/ui.ts build             write public/art/sprites/<key>.png + .json and list them in
 *                                          the manifest
 *   node art/tools/ui.ts preview OUT.png   a contact sheet of every frame
 *
 * Run from the repository root. Text is never baked in: the game sets it with font-body or
 * font-title at 2x. A text origin below is a BitmapText's top-left at scale 2, and A is the text's
 * advance width at 2x (the sum of xadvance, doubled). Positions are in base pixels, top-left of the
 * frame, matching art/layout.md.
 *
 * Nine-slice textures carry their margins (left, top, right, bottom) as a sheet slice named
 * after the key and as "slice" in the manifest entry. Single-state art has one tag, "rest", at
 * 100ms. The touch buttons' press tag plays once and holds its last frame (the manifest's "once")
 * until the game shows the held tag; every other tag loops.
 *
 * Dialogue
 * - ui-dialogue-box, 640x96. Navy, ink border with cut corners, slate rim top-left, dslate
 *   bottom-right. Body text cream, lines every 20.
 * - ui-portrait-frame, 68x68. Recessed dslate well round the 64px portrait, 2px in.
 * - ui-name-tab, nine-slice 12x20, margins 2,2,2,2; tags amber, green, pink, tan (the fill; one per
 *   speaker). Drawn A+12 wide inside the box. Name ink, origin x+6.
 * Placement belongs to the runtime layout (DIALOGUE_LAYOUT in src/data/layout.ts) and the style guide's
 * dialogue box table.
 *
 * Touch controls (two round buttons for the right thumb, a pause button at the top left and the
 * move hint at the left)
 * - Positions here are the base 720x360 layout as drawn. At runtime the game keeps every control
 *   inside the game's view across, ui-pause at the view's top and Use, Jump and the move hint at
 *   the screen's bottom, and sizes their press areas (src/ui/layout/hitAreas.ts). Each drawn edge sits
 *   at least 8px from the edge it is placed against, and the pause disc 8px in from the top and
 *   left. Use, Jump and move hint placement belongs to the runtime layout
 *   (src/data/layout.ts) and the style guide's touch controls table.
 * - ui-touch-use, 75x75, centre pixel 37,37.
 * - ui-touch-jump, 75x75, centre pixel 37,37, towards the bottom-right corner, with Use above and
 *   to its left.
 * - Each is the move hint's open ring, 73px across with no face: a 2px cream band between 1px ink
 *   lines, with its icon centred in 2px strokes and fringed in ink, so it reads on any ground:
 *   three round dots (25x7) on Use, their top 3px above the centre, and a caret (21x11) on Jump,
 *   its top 5px above. No label. Tags rest (100ms); press, once (frame 0 the band and icon turn
 *   white and the ring swells 1px; frame 1 the same at rest size; 60ms each); held (as press frame
 *   1, 100ms).
 * - ui-pause, 35x35, centre pixel 17,17: top-left 7,7 for the centre 24,24, its disc 8px in from
 *   the top and left. A disc 33px across: an ink edge, a 2px cream ring (3px pressed) and a navy
 *   face (dslate pressed), with two pause bars (11x13, each 4 wide, 3 apart) centred on the centre;
 *   no label. Tags as for Use and Jump: rest; press, once (2 frames at 60ms, frame 0 swells 1px);
 *   held.
 * - ui-move-hint, 75x75, centre pixel 37,37: a drawing only, with no press area. An open ring 73px
 *   across with no face, a 2px cream band between 1px ink lines, and a 2x chevron (8x10) each side,
 *   22px from the centre, fringed in ink, so it reads on any ground, sky, character or prop. At
 *   rest it mirrors Jump at the bottom-left. While a touch moves her, the game
 *   draws it centred on that touch's neutral point (where the drag began), anywhere on screen, and
 *   puts it back on release. Tags rest; held-left and held-right (the dragged side's chevron
 *   white); one frame each.
 * - ui-move-knob, 11x11, centre pixel 5,5: a 9px knob fringed in ink, drawn on the hint's centre
 *   and offset by the drag's distance from its neutral point, left or right, capped at 12px. Tags
 *   rest (cream), held (white).
 *
 * Button labels
 * - Every button's label is font-body at 2x, mixed case ("Start", "Resume", "Continue",
 *   "Install"), set by the game. It is centred on the button: origin x = the button's centre x -
 *   floor(ink width / 2), where the ink width is the label's visible width (advance - 2). Start,
 *   Resume and Continue lead with ui-play-mark: the mark, a 6px gap and the label's ink are centred
 *   as one group by the same rule, the mark at the group's x and the label's origin 11 to its
 *   right. Origin y is fixed per button, below; the label and the mark sink 2px while pressed.
 * - ui-play-mark, 5x10: rest is ink for pale/green faces; light is cream for dark primary faces.
 *   Both static 100ms tags share the same triangle, its top 4 rows below the label's origin y.
 *
 * Start screen (720x360, over the street)
 * - ui-nav-bar, nine-slice 12x48, margins 1,1,1,3: a navy band ending in a slate line over an ink
 *   line, drawn 720x48 at 0,0.
 * - ui-icon-button, 36x36, tags normal and pressed (the face sinks 2px): an ink line with cut
 *   corners, a dslate face with a slate top highlight on a navy lip. Its 20x20 icon goes at button
 *   + (8,6), or (8,8) pressed. With Exit: Settings at 632,6 (hit 628,2,44,44, icon 640,12) and Exit
 *   at 676,6 (hit 672,2,44,44, icon 684,12). Without Exit (Firefox for Android's installed app):
 *   Settings at 676,6 (hit 672,2,44,44, icon 684,12).
 * - Nav icons, 20x20: icon-settings-nav (the cog) and ui-quit's normal frame (Exit: the doorway
 *   and arrow).
 *
 * Pause card, settings card and install steps card (each over the game dimmed two ramp steps, one
 * at a time)
 * - ui-settings-card, nine-slice 16x16, margins 2,2,2,2: an ink border with cut corners round an
 *   lgrey face (pale steel), a white rim on the top and left and a grey rim on the bottom and
 *   right; no header. Every card is drawn 368 wide at 176,88. Title ink in font-title (11.0:1 on
 *   lgrey), centred on x 360: origin x = 358 minus floor((A - 4) / 2), where A is its advance width
 *   at 2x, origin y 96.
 * - ui-close, 24x24, at 510,94 (hit 500,88,44,44), the card's top right, on every card. Tags normal
 *   (ink X), pressed (white X on dslate).
 * - A settings row has no art, as on dog-walker-game's settings card: a 352x48 hit area at x 184
 *   holding its 16x16 icon at 198,y+16, its label (font-body, ink) at origin 228,y+15 and, for a
 *   toggle, ui-switch at 496,y+16.
 * - Pause card, 368x236, title "Paused": three buttons 352x48 at x 184, 4 apart: Resume
 *   (ui-button-primary) at y 136, Settings at y 188 and Back to title at y 240 (ui-button). Labels
 *   centred, origin y = button y + 13.
 * - Settings card, title "Settings": 368x236 with the Install row, 368x184 without it. Rows: "Move
 *   controls" at y 136 (icon-move-controls) and "Action buttons" at y 188 (icon-touch-controls),
 *   each with ui-switch, both on by default; Install at y 240, only while the app is installable
 *   (icon-install; ui-button drawn 72x28 at 452,250, centred on x 488, label ink, origin y 253;
 *   room 56). The build label, dslate in font-body (5.83:1 on lgrey), for example "v0.0.1 · dev",
 *   is centred on x 360 with its origin 28 above the card's foot: y 296, or 244 without Install.
 * - Install steps card, 368x160, title "Install". Two steps, each a 16x16 glyph and up to two lines
 *   of ink font-body at a 20px pitch, room 296: step 1's glyph (icon-ios-share on iOS,
 *   icon-browser-menu where the browser installs from its menu) at 198,145, text origin 228,144;
 *   step 2's glyph (icon-install) at 198,197, text origin 228,196.
 * - ui-focus, nine-slice 16x16, margins 4,4,4,4: the keyboard focus ring, a 2px yellow band between
 *   1px ink lines with cut corners. Draw it at (x-4, y-4, w+8, h+8) round the focused element's hit
 *   area or face: a row (360x56, the Install row included), Resume (168x52), a nav button (44x44)
 *   or the close X's 24x24 mark (32x32). One tag, rest.
 * - ui-switch, 32x16, dog-walker-game's switch: an ink-rimmed track with a white knob, at the right
 *   with a white tick on dgreen when on, at the left with a white cross on slate when off, so the
 *   state reads by knob side and glyph as well as colour. Tags on, off.
 * - ui-quit, 20x20: the doorway with an arrow leaving it, the nav's Exit icon. Tags normal (cream),
 *   pressed (white, the arrow 2px further out).
 * - ui-button, nine-slice 16x28, margins 2,4,2,6: the secondary button, dog-walker-game's shape
 *   with no outline and cut corners: a grey face, one step darker than the card, with an lgrey
 *   highlight on its top row and a slate lip 4px deep. Label ink (6.39:1 on grey). Tags normal,
 *   pressed (the face sinks 2px and the lip is gone, so its label moves down 2). The appended
 *   disabled tag keeps normal alpha geometry with one flat opaque lgrey fill.
 * - ui-button-primary, nine-slice 16x28, margins 2,4,2,6: the primary button, ui-button's
 *   geometry, tags and press in dark steel: a dslate face, a slate highlight and a navy lip. Label
 *   white (9.55:1 on dslate). Its appended disabled tag matches ui-button's flat lgrey face; runtime
 *   disabled labels use dslate.
 * - 16x16 row icons, one tag, rest: icon-touch-controls (a round touch button with the Jump
 *   caret), icon-install (an arrow down into a tray), icon-ios-share (Safari's Share button),
 *   icon-browser-menu (three stacked dots) and icon-move-controls (the move hint in small: a round
 *   ring with a chevron each side). All are flat dslate; line icons use 2px strokes (5.83:1 on the
 *   card's lgrey).
 * - ui-resume, 160x44: a green button with the play mark, the map's Continue at 280,300 (the hit
 *   area; art/tools/map.ts places its label). Tags normal, pressed (the face sinks 2px into its
 *   lip).
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { darker, Grid } from "./pixel.ts";

type Colour = string | null;
type Points = [number, number][];

const USAGE = "Usage: ui.ts build | preview OUT.png";

// Name tab fills, one tag each: hues the panels do not use. Ink text holds at least 6.6:1 on each,
// and each holds at least 5:1 as text on the navy panels, so a speaker's name can be set in the
// same colour.
const TAB_FILLS = ["amber", "green", "pink", "tan"];

/** A bitmap from strings: '#' is set. */
function bm(...rows: readonly string[]): Points {
  const points: Points = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") {
        points.push([x, y]);
      }
    });
  });
  return points;
}

function stamp(g: Grid, pts: Points, x: number, y: number, c: Colour): void {
  for (const [px, py] of pts) {
    g.p(x + px, y + py, c);
  }
}

/**
 * A box: a 1px border with cut corners, and a 1px rim inside it (the first colour on the top and
 * left, the second on the bottom and right).
 */
function panel(
  {
    border = "ink",
    rim = ["slate", "dslate"],
  }: { border?: string; rim?: readonly Colour[] | null },
  g: Grid,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  g.rect(x, y, w, h, border);
  for (const [cx, cy] of [
    [x, y],
    [x + w - 1, y],
    [x, y + h - 1],
    [x + w - 1, y + h - 1],
  ] as const) {
    g.p(cx, cy, null);
  }
  g.rect(x + 1, y + 1, w - 2, h - 2, fill);
  if (rim) {
    const [lt, rb] = rim;
    if (lt) {
      g.rect(x + 1, y + 1, w - 2, 1, lt);
      g.rect(x + 1, y + 1, 1, h - 2, lt);
    }
    if (rb) {
      g.rect(x + 1, y + h - 2, w - 2, 1, rb);
      g.rect(x + w - 2, y + 2, 1, h - 3, rb);
    }
  }
}

/** A right-pointing triangle h tall (even), stepping 1px per column: h/2 wide. */
function triRight(g: Grid, x: number, y: number, h: number, c: string): void {
  for (let i = 0; i < Math.floor(h / 2); i++) {
    g.rect(x + i, y + i, 1, h - 2 * i, c);
  }
}

/** Distance from the origin; the squares here are exact, so one square root is correctly rounded. */
function hypot(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------- dialogue

function dialogueBox(): pixel.Frame {
  const g = new Grid(640, 96);
  panel({}, g, 0, 0, 640, 96, "navy");
  return g.px;
}

/** Recessed: the shade on the top and left, the light on the bottom and right. */
function portraitFrame(): pixel.Frame {
  const g = new Grid(68, 68);
  panel({ rim: ["navy", "slate"] }, g, 0, 0, 68, 68, "dslate");
  return g.px;
}

function nameTab(fill: string): pixel.Frame {
  const g = new Grid(12, 20);
  panel({ rim: [null, darker(fill)] }, g, 0, 0, 12, 20, fill);
  return g.px;
}

// ---------------------------------------------------------------- touch controls

type ButtonKey = "jump" | "pause" | "use";

// Disc radius: 73, 73 and 33px across.
const BUTTON_R: Record<ButtonKey, number> = { use: 36, jump: 36, pause: 16 };
// The pause disc's cream ring at rest; pressed, it thickens 1px.
const RING_W = { pause: 2 };
// 21x11, 2px strokes.
const CARET: Points = [];
for (let y = 0; y < 11; y++) {
  for (const x of [10 - y, 11 - y, 9 + y, 10 + y]) {
    CARET.push([x, y]);
  }
}
const DOT = bm("..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###..");
// 25x7.
const DOTS: Points = [];
for (let i = 0; i < 3; i++) {
  for (const [x, y] of DOT) {
    DOTS.push([x + i * 9, y]);
  }
}
// 11x13, two pause bars.
const BARS: Points = [];
for (let i = 0; i < 2; i++) {
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 13; y++) {
      BARS.push([x + i * 7, y]);
    }
  }
}
// Bitmap, top row relative to the centre.
const ICON: Record<ButtonKey, readonly [Points, number]> = {
  use: [DOTS, -3],
  jump: [CARET, -5],
  pause: [BARS, -6],
};

function disc(g: Grid, cx: number, cy: number, r: number, c: string): void {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= (r + 0.5) ** 2) {
        g.p(x, y, c);
      }
    }
  }
}

/**
 * frame undefined is rest; 0 and 1 the press; 2 held. Use and Jump are the move hint's open ring
 * with the icon fringed in ink and centred; ui-pause is a disc. Pressed, the band and icon turn
 * white; frame 0 swells the ring or disc 1px. The pause disc's ring also thickens 1px and its face
 * lifts to dslate.
 */
function touchButtonFrame(key: ButtonKey, frame?: number): pixel.Frame {
  const r = BUTTON_R[key] + (frame === 0 ? 1 : 0);
  const c = BUTTON_R[key] + 1;
  const hot = frame !== undefined;
  const band = hot ? "white" : "cream";
  const g = new Grid(2 * c + 1, 2 * c + 1);
  const [pts, top] = ICON[key];
  const w = Math.max(...pts.map(([x]) => x)) + 1;
  if (key === "pause") {
    disc(g, c, c, r, "ink");
    disc(g, c, c, r - 1, band);
    disc(g, c, c, r - 1 - RING_W[key] - (hot ? 1 : 0), hot ? "dslate" : "navy");
    stamp(g, pts, c - Math.floor(w / 2), c + top, band);
    return g.px;
  }
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const d = hypot(x - c, y - c);
      if (r - 3.5 < d && d <= r + 0.5) {
        g.p(x, y, d > r - 0.5 || d <= r - 2.5 ? "ink" : band);
      }
    }
  }
  const marks = new Grid(g.w, g.h);
  stamp(marks, pts, c - Math.floor(w / 2), c + top, band);
  fringed(g, marks);
  return g.px;
}

function touchButton(key: ButtonKey): pixel.Tags {
  return [
    ["rest", [touchButtonFrame(key)], 100],
    ["press", [touchButtonFrame(key, 0), touchButtonFrame(key, 1)], 60],
    ["held", [touchButtonFrame(key, 2)], 100],
  ];
}

// ---------------------------------------------------------------- settings

/**
 * 16x16 nine-slice: an ink border with cut corners round an lgrey face (pale steel), lit top-left:
 * a white rim on the top and left, a grey rim on the bottom and right. No header.
 */
function settingsCard(): pixel.Frame {
  const g = new Grid(16, 16);
  panel({ rim: ["white", "grey"] }, g, 0, 0, 16, 16, "lgrey");
  return g.px;
}

/**
 * 160x44: an ink border, a green face and a dark green lip 4px deep; pressed, the face sinks 2px
 * into it. No triangle or label is drawn in: the game draws ui-play-mark and the label, centred as
 * one group.
 */
function resume(state: string): pixel.Frame {
  const top = state === "normal" ? 0 : 2;
  const g = new Grid(160, 44);
  panel({ rim: null }, g, 0, top, 160, 44 - top, "dgreen");
  g.rect(1, top + 1, 158, 38, "green");
  return g.px;
}

const X: Points = [];
for (let i = 0; i < 12; i++) {
  X.push([i, i]);
}
for (let i = 0; i < 11; i++) {
  X.push([i + 1, i]);
}
for (let i = 0; i < 12; i++) {
  X.push([11 - i, i]);
}
for (let i = 0; i < 11; i++) {
  X.push([10 - i, i]);
}

/**
 * 16x28 nine-slice, the dog-walker-game button: no outline, cut corners, a face with a 1px
 * highlight on its top row and a lip 4px deep; pressed, the face sinks 2px and the lip is gone.
 */
function plate(
  { face, hi, lip }: { face: string; lip: string; hi: string },
  state: string,
): pixel.Frame {
  const disabled = state === "disabled";
  const [f, l, h] = disabled ? ["lgrey", "lgrey", "lgrey"] : [face, lip, hi];
  const g = new Grid(16, 28);
  const top = disabled || state === "normal" ? 0 : 2;
  if (!top) {
    g.rect(1, 24, 14, 4, l);
    g.rect(0, 24, 16, 3, l);
  }
  g.rect(1, top, 14, 24, f);
  g.rect(0, top + 1, 16, 22, f);
  g.rect(2, top + 1, 12, 1, h);
  return g.px;
}

/** The secondary button: a grey face, an lgrey highlight and a slate lip, one step darker than the card. */
function button(state: string): pixel.Frame {
  return plate({ face: "grey", lip: "slate", hi: "lgrey" }, state);
}

/** The primary button: a dslate face, a slate highlight and a navy lip. */
function buttonPrimary(state: string): pixel.Frame {
  return plate({ face: "dslate", lip: "navy", hi: "slate" }, state);
}

/**
 * 32x16, dog-walker-game's switch on the card: an ink-rimmed track, the white knob at the right
 * and a white tick on dgreen when on, at the left with a white cross on slate when off.
 */
function toggle(on: boolean): pixel.Frame {
  const [track, sh] = on ? ["dgreen", "forest"] : ["slate", "dslate"];
  const g = new Grid(32, 16);
  for (let dy = 0; dy < 16; dy++) {
    const inset = Math.abs(dy - 7.5) < 8 ? pixel.round(8 - Math.sqrt(64 - (dy - 7.5) ** 2)) : 8;
    g.rect(inset, dy, 32 - 2 * inset, 1, "ink");
    if (dy > 0 && dy < 15) {
      const inner = Math.abs(dy - 7.5) < 7 ? pixel.round(8 - Math.sqrt(49 - (dy - 7.5) ** 2)) : 8;
      g.rect(inner + 1, dy, 30 - 2 * inner, 1, dy === 1 ? sh : track);
    }
  }
  const kx = on ? 23.5 : 8.5;
  g.ell(kx, 8, 6, 6, "ink");
  g.ell(kx, 8, 5, 5, "white", "lgrey");
  if (on) {
    for (const [x, y] of [
      [4, 8],
      [5, 9],
      [6, 10],
      [7, 9],
      [8, 8],
      [9, 7],
      [10, 6],
      [11, 5],
    ] as const) {
      g.rect(x, y, 1, 2, "white");
    }
  } else {
    for (let i = 0; i < 5; i++) {
      g.rect(19 + i, 5 + i, 1, 2, "white");
      g.rect(23 - i, 5 + i, 1, 2, "white");
    }
  }
  return g.px;
}

// 16x16 icons sit on the card's lgrey face: 5.83:1.
const ROW_ICON = "dslate";

/** A 16x16 icon from 16 strings ('#' is ROW_ICON): flat, 2px strokes. */
function icon(rows: readonly string[]): pixel.Frame {
  const g = new Grid(16, 16);
  stamp(g, bm(...rows), 0, 0, ROW_ICON);
  return g.px;
}

const DOT4 = [".##.", "####", "####", ".##."];
const dots = DOT4.map((r) => `......${r}......`);
const ICONS: Record<string, readonly string[]> = {
  // a down arrow into a tray
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
  // Safari's Share button: a box open at the top with an arrow rising out of it
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
  // the browser menu button: three round dots stacked on the centre line
  "icon-browser-menu": [
    ...dots,
    ...Array<string>(2).fill("................"),
    ...dots,
    ...Array<string>(2).fill("................"),
    ...dots,
  ],
};

// ui-move-hint's ring: 73 across, like Use and Jump.
const MOVE_R = 36;
// A 4x5 design at 2x: 8x10, pointing left.
const CHEVRON_2X = ["..##", ".##.", "##..", ".##.", "..##"];

/** Stamp marks (a Grid of fills) onto g with a 1px ink fringe round them, so they hold on any ground. */
function fringed(g: Grid, marks: Grid): void {
  const nH = marks.px.length;
  const nW = (marks.px[0] as Colour[]).length;
  const at = (x: number, y: number): Colour => (marks.px[y] as Colour[])[x] ?? null;
  for (let y = 0; y < nH; y++) {
    for (let x = 0; x < nW; x++) {
      if (at(x, y)) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < nW && yy >= 0 && yy < nH && !at(xx, yy)) {
            g.p(xx, yy, "ink");
          }
        }
      }
    }
  }
  for (let y = 0; y < nH; y++) {
    for (let x = 0; x < nW; x++) {
      const colour = at(x, y);
      if (colour) {
        g.p(x, y, colour);
      }
    }
  }
}

/**
 * 75x75, centre pixel 37,37: an open ring with no face, a 2px cream band between 1px ink lines, and
 * a 2x chevron each side with an ink fringe. lit is the dragged side (-1 left, 1 right), whose
 * chevron turns white.
 */
function moveHint(lit = 0): pixel.Frame {
  const n = 2 * (MOVE_R + 1) + 1;
  const c = Math.floor(n / 2);
  const g = new Grid(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = hypot(x - c, y - c);
      if (MOVE_R - 3.5 < d && d <= MOVE_R + 0.5) {
        g.p(x, y, d > MOVE_R - 0.5 || d <= MOVE_R - 2.5 ? "ink" : "cream");
      }
    }
  }
  const marks = new Grid(n, n);
  for (const side of [-1, 1]) {
    CHEVRON_2X.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === "#") {
          const xx = side > 0 ? 3 - x : x;
          marks.rect(
            c + side * 22 - 4 + xx * 2,
            c - 5 + y * 2,
            2,
            2,
            side === lit ? "white" : "cream",
          );
        }
      });
    });
  }
  fringed(g, marks);
  return g.px;
}

/** 11x11, centre pixel 5,5: a round 9px knob (cream at rest, white while held) with an ink fringe. */
function moveKnob(held: boolean): pixel.Frame {
  const g = new Grid(11, 11);
  const marks = new Grid(11, 11);
  disc(marks, 5, 5, 4, held ? "white" : "cream");
  fringed(g, marks);
  return g.px;
}

/** A round 2px ring centred on a 16x16 frame. */
function smallRing(g: Grid): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = hypot(x - 7.5, y - 7.5);
      if (d >= 5.9 && d <= 7.9) {
        g.p(x, y, ROW_ICON);
      }
    }
  }
}

/** icon-move-controls, 16x16: the move hint in small, a round 2px ring with a chevron each side. */
function moveControlsIcon(): pixel.Frame {
  const g = new Grid(16, 16);
  smallRing(g);
  for (const [x, y] of [
    [5, 5],
    [4, 6],
    [3, 7],
    [3, 8],
    [4, 9],
    [5, 10],
  ] as const) {
    g.rect(x, y, 2, 1, ROW_ICON);
    g.rect(14 - x, y, 2, 1, ROW_ICON);
  }
  return g.px;
}

/** A touch button: a round 2px ring with the Jump caret (2px strokes) inside, centred on the frame. */
function touchControlsIcon(): pixel.Frame {
  const g = new Grid(16, 16);
  smallRing(g);
  g.rect(7, 6, 2, 1, ROW_ICON);
  for (let i = 0; i < 3; i++) {
    g.rect(6 - i, 7 + i, 2, 1, ROW_ICON);
    g.rect(8 + i, 7 + i, 2, 1, ROW_ICON);
  }
  return g.px;
}

/**
 * 16x16 nine-slice, margins 4: the keyboard focus ring. From the outside in: a 1px ink fringe, a
 * 2px yellow band and a 1px ink line, with cut corners, and a clear centre. Drawn 4px outside the
 * element on every side, so the yellow band sits 2 to 3px outside its edge and the ink holds it
 * apart from any fill on either side.
 */
function focus(): pixel.Frame {
  const g = new Grid(16, 16);
  for (const [k, c] of [
    [0, "ink"],
    [1, "yellow"],
    [3, "ink"],
  ] as const) {
    const w = 16 - 2 * k;
    g.rect(k, k, w, w, c);
    for (const [cx, cy] of [
      [k, k],
      [k + w - 1, k],
      [k, k + w - 1],
      [k + w - 1, k + w - 1],
    ] as const) {
      g.p(cx, cy, k === 0 ? null : k === 1 ? "ink" : "yellow");
    }
  }
  g.rect(4, 4, 8, 8, null);
  return g.px;
}

// The nav icons share their shapes with dog-walker-game's: the cog (icon-settings-nav) and the
// doorway with an arrow leaving it (ui-quit).

/**
 * icon-settings-nav, the cog at 20x20: a 4px-wide tooth on each axis, a 3x3 tooth on each
 * diagonal, a ring and a round hole.
 */
function cog20(): pixel.Frame {
  const g = new Grid(20, 20);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      const dx = Math.abs(x + 0.5 - 10);
      const dy = Math.abs(y + 0.5 - 10);
      const r = hypot(dx, dy);
      const diag = dx >= 5.5 && dx <= 7.5 && dy >= 5.5 && dy <= 7.5;
      if (r > 3.6 && (r <= 7.2 || Math.min(dx, dy) <= 1.5 || diag)) {
        g.p(x, y, "cream");
      }
    }
  }
  return g.px;
}

/**
 * 36x36: a nav button for a 20x20 icon at 8,6 (8,8 pressed). An ink line with cut corners, a
 * dslate face with a slate top highlight on a navy lip 4px deep; pressed, the face sinks 2px.
 */
function iconButton(state: string): pixel.Frame {
  const top = state === "normal" ? 0 : 2;
  const g = new Grid(36, 36);
  panel({ rim: null }, g, 0, top, 36, 36 - top, "navy");
  g.rect(1, top + 1, 34, 30, "dslate");
  if (state === "normal") {
    g.rect(2, 1, 32, 1, "slate");
  }
  return g.px;
}

/** 12x48 nine-slice, margins 1,1,1,3: a navy band ending in a slate line over an ink line. */
function navBar(): pixel.Frame {
  const g = new Grid(12, 48);
  g.rect(0, 0, 12, 46, "navy");
  g.rect(0, 46, 12, 1, "slate");
  g.rect(0, 47, 12, 1, "ink");
  return g.px;
}

/** 5x10: the same triangle in ink for pale/green faces or cream for dark primary faces. */
function playIcon(colour = "ink"): pixel.Frame {
  const g = new Grid(5, 10);
  triRight(g, 0, 0, 10, colour);
  return g.px;
}

/**
 * 20x20: a doorway (2px strokes, open on the right) with an arrow leaving through it. Pressed, the
 * arrow steps 2px further out and turns white.
 */
function quitIcon(state: string): pixel.Frame {
  const [c, dx] = state === "pressed" ? ["white", 2] : ["cream", 0];
  const g = new Grid(20, 20);
  g.rect(1, 1, 12, 2, c);
  g.rect(1, 17, 12, 2, c);
  g.rect(1, 1, 2, 18, c);
  g.rect(11, 1, 2, 5, c);
  g.rect(11, 14, 2, 5, c);
  g.rect(6 + dx, 9, 7, 2, c);
  triRight(g, 13 + dx, 5, 10, c);
  return g.px;
}

function close(state: string): pixel.Frame {
  const g = new Grid(24, 24);
  if (state === "pressed") {
    panel({ border: "dslate", rim: null }, g, 0, 0, 24, 24, "dslate");
  }
  stamp(g, X, 6, 6, state === "pressed" ? "white" : "ink");
  return g.px;
}

// ---------------------------------------------------------------- the set

export const SLICES: Record<string, pixel.Margins> = {
  "ui-name-tab": [2, 2, 2, 2],
  "ui-nav-bar": [1, 1, 1, 3],
  "ui-button": [2, 4, 2, 6],
  "ui-button-primary": [2, 4, 2, 6],
  "ui-focus": [4, 4, 4, 4],
  "ui-settings-card": [2, 2, 2, 2],
};

// Tags that play once and hold their last frame; every other tag loops.
export const ONCE: Record<string, readonly string[]> = {
  "ui-pause": ["press"],
  "ui-touch-jump": ["press"],
  "ui-touch-use": ["press"],
};

const states = (names: readonly string[], frame: (state: string) => pixel.Frame): pixel.Tags =>
  names.map((state) => [state, [frame(state)], 100]);

export function* sprites(): Generator<pixel.SpriteEntry> {
  const one = (frame: pixel.Frame, tag = "rest"): pixel.Tags => [[tag, [frame], 100]];
  for (const key of Object.keys(ICONS).sort()) {
    yield [key, one(icon(ICONS[key] as string[]))];
  }
  yield ["icon-settings-nav", one(cog20())];
  yield ["icon-move-controls", one(moveControlsIcon())];
  yield ["icon-touch-controls", one(touchControlsIcon())];
  yield ["ui-button", states(["normal", "pressed", "disabled"], button)];
  yield ["ui-button-primary", states(["normal", "pressed", "disabled"], buttonPrimary)];
  yield ["ui-switch", states(["on", "off"], (state) => toggle(state === "on"))];
  yield ["ui-close", states(["normal", "pressed"], close)];
  yield ["ui-dialogue-box", one(dialogueBox())];
  yield ["ui-focus", one(focus())];
  yield ["ui-icon-button", states(["normal", "pressed"], iconButton)];
  yield [
    "ui-move-hint",
    [
      ["rest", [moveHint()], 100],
      ["held-left", [moveHint(-1)], 100],
      ["held-right", [moveHint(1)], 100],
    ],
  ];
  yield [
    "ui-move-knob",
    [
      ["rest", [moveKnob(false)], 100],
      ["held", [moveKnob(true)], 100],
    ],
  ];
  yield ["ui-name-tab", TAB_FILLS.map((c) => [c, [nameTab(c)], 100])];
  yield ["ui-nav-bar", one(navBar())];
  yield ["ui-pause", touchButton("pause")];
  yield [
    "ui-play-mark",
    [
      ["rest", [playIcon()], 100],
      ["light", [playIcon("cream")], 100],
    ],
  ];
  yield ["ui-portrait-frame", one(portraitFrame())];
  yield ["ui-quit", states(["normal", "pressed"], quitIcon)];
  yield ["ui-resume", states(["normal", "pressed"], resume)];
  yield ["ui-settings-card", one(settingsCard())];
  yield ["ui-touch-jump", touchButton("jump")];
  yield ["ui-touch-use", touchButton("use")];
}

const OPTIONS: pixel.MainOptions = { once: ONCE, slices: SLICES, usage: USAGE };

export function build(): Promise<void> {
  return pixel.build(OPTIONS, [...sprites()]);
}

if (import.meta.main) {
  run(() => pixel.main(OPTIONS, sprites));
}
