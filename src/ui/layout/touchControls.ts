import {
  CONTROL_BOTTOM,
  CONTROL_FRAME_INSET,
  CONTROL_SIDE,
  TOUCH_CIRCLE_RADIUS,
  TOUCH_LAYOUT,
} from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { Point, Rect } from "../../data/types";
import { TOUCH_CHROME_FRAME } from "../chrome/touchChrome";
import type { PressArea, PressShape } from "./hitAreas";

export type TouchControl = "jump" | "use";

// Art's touch buttons are discs drawn in TOUCH_CHROME_FRAME squares, each frame's centre pixel
// on its button's centre.
const BUTTON_FRAME = TOUCH_CHROME_FRAME;

// Where a button is drawn: its frame, its centre pixel on centre.
function buttonArt(centre: Point): Rect {
  const half = (BUTTON_FRAME - 1) / 2;
  return { height: BUTTON_FRAME, width: BUTTON_FRAME, x: centre.x - half, y: centre.y - half };
}

// Art draws each control CONTROL_FRAME_INSET inside its frame, so a frame's centre pixel is this
// far from the drawn edge on each side.
const DRAWN_HALF = (BUTTON_FRAME - 1) / 2 - CONTROL_FRAME_INSET;

// Jump CONTROL_SIDE in from the view's right and CONTROL_BOTTOM above the bottom; Use's centre
// TOUCH_LAYOUT.useFromJump from Jump's, so it moves with Jump.
const JUMP_CENTRE = {
  x: SCREEN.width - 1 - CONTROL_SIDE - DRAWN_HALF,
  y: SCREEN.height - 1 - CONTROL_BOTTOM - DRAWN_HALF,
};
const USE_CENTRE = {
  x: JUMP_CENTRE.x + TOUCH_LAYOUT.useFromJump.x,
  y: JUMP_CENTRE.y + TOUCH_LAYOUT.useFromJump.y,
};
const USE_ART = buttonArt(USE_CENTRE);
const JUMP_ART = buttonArt(JUMP_CENTRE);

// The move hint's radius: its frame, the buttons' size, from its centre pixel to its edge.
const HINT_RADIUS = (BUTTON_FRAME - 1) / 2;

// Each button presses within TOUCH_CIRCLE_RADIUS plus the hint's radius of its centre, so a drag,
// which starts only off the buttons, draws the hint clear of each button's TOUCH_CIRCLE_RADIUS;
// the two circles are cut along the line midway between the centres, so they meet and never
// overlap. Jump's reaches on into the screen's bottom-right corner, away from Use: the rect from
// its centre to the corner, where a thumb reaching for it lands.
const RADIUS = TOUCH_CIRCLE_RADIUS + HINT_RADIUS;
const USE_HIT: PressShape = { awayFrom: JUMP_CENTRE, centre: USE_CENTRE, radius: RADIUS };
const JUMP_HIT: PressShape = [
  { awayFrom: USE_CENTRE, centre: JUMP_CENTRE, radius: RADIUS },
  {
    height: SCREEN.height - JUMP_CENTRE.y,
    width: SCREEN.width - JUMP_CENTRE.x,
    x: JUMP_CENTRE.x,
    y: JUMP_CENTRE.y,
  },
];

// Art's touch buttons, in base pixels: each button's centre, where it is drawn, and the area a
// touch must start in to take it (hitAreas.ts).
export const TOUCH_CONTROLS: Readonly<
  Record<TouchControl, { art: Rect; centre: Point; hit: PressShape }>
> = {
  jump: { art: JUMP_ART, centre: JUMP_CENTRE, hit: JUMP_HIT },
  use: { art: USE_ART, centre: USE_CENTRE, hit: USE_HIT },
};

// The touch buttons' press areas, for pressedArea.
export const TOUCH_PRESS_AREAS: readonly PressArea<TouchControl>[] = (
  Object.keys(TOUCH_CONTROLS) as TouchControl[]
).map((key) => ({ art: TOUCH_CONTROLS[key].art, hit: TOUCH_CONTROLS[key].hit, key }));

// Art's move hint, a drawing with no press area of its own (movement is the floating drag
// everywhere off the buttons): a ring in a frame the buttons' size, centred at rest on centre,
// and a knob that moves from the ring's centre at most knobReach pixels left or right the way
// the drag goes (TOUCH_LAYOUT). At rest it mirrors Jump: CONTROL_SIDE in from the view's left,
// level with Jump.
const MOVE_HINT_CENTRE: Point = { x: CONTROL_SIDE + DRAWN_HALF, y: JUMP_CENTRE.y };
export const MOVE_HINT = {
  art: buttonArt(MOVE_HINT_CENTRE),
  centre: MOVE_HINT_CENTRE,
  knobReach: TOUCH_LAYOUT.knobReach,
} as const;
