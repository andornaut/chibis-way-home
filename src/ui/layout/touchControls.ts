import { SCREEN } from "../../data/screen";
import type { Point, Rect } from "../../data/types";
import { type PressArea, type PressShape, TOUCH_CIRCLE_RADIUS } from "./hitAreas";
import { CONTROL_BOTTOM, CONTROL_EDGE } from "./playView";

export type TouchControl = "jump" | "use";

// Art's touch buttons are discs drawn in frames this many base pixels square, each frame's
// centre pixel on its button's centre.
const BUTTON_FRAME = 75;

// Where a button is drawn: its frame, its centre pixel on centre.
function buttonArt(centre: Point): Rect {
  const half = (BUTTON_FRAME - 1) / 2;
  return { height: BUTTON_FRAME, width: BUTTON_FRAME, x: centre.x - half, y: centre.y - half };
}

// Art draws each control 1px inside its frame, so a frame's centre pixel is this far from the
// drawn edge on each side.
const DRAWN_HALF = (BUTTON_FRAME - 1) / 2 - 1;

// Jump at the view's right, CONTROL_EDGE in, and CONTROL_BOTTOM above the bottom; Use's ring
// USE_RIGHT in from the view's right, its centre USE_ABOVE_JUMP above Jump's.
const JUMP_CENTRE = {
  x: SCREEN.width - 1 - CONTROL_EDGE - DRAWN_HALF,
  y: SCREEN.height - 1 - CONTROL_BOTTOM - DRAWN_HALF,
};
const USE_RIGHT = 85;
const USE_ABOVE_JUMP = 100;
const USE_CENTRE = {
  x: SCREEN.width - 1 - USE_RIGHT - DRAWN_HALF,
  y: JUMP_CENTRE.y - USE_ABOVE_JUMP,
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
// the drag goes. At rest it sits level with Jump, as far in from the view's left as Use is from
// its right.
const MOVE_HINT_CENTRE: Point = { x: SCREEN.width - 1 - USE_CENTRE.x, y: JUMP_CENTRE.y };
export const MOVE_HINT = {
  art: buttonArt(MOVE_HINT_CENTRE),
  centre: MOVE_HINT_CENTRE,
  knobReach: 12,
} as const;
