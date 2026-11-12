import type { RenderFit } from "@andornaut/game-kit/view/renderScale";

import {
  CONTROL_BOTTOM,
  CONTROL_FRAME_INSET,
  CONTROL_SIDE,
  CONTROL_VIEW_MARGIN,
  TOUCH_CIRCLE_RADIUS,
  TOUCH_LAYOUT,
} from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Point, Rect } from "../../data/types/index.ts";
import { TOUCH_CHROME_FRAME } from "../chrome/touchChrome.ts";
import type { PressArea, PressShape } from "./hitAreas.ts";
import { viewBars } from "./playView.ts";

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

// The move hint's radius: its frame, the buttons' size, from its centre pixel to its edge.
const HINT_RADIUS = (BUTTON_FRAME - 1) / 2;

// Each button presses within TOUCH_CIRCLE_RADIUS plus the hint's radius of its centre, so a drag,
// which starts only off the buttons, draws the hint clear of each button's TOUCH_CIRCLE_RADIUS;
// the two circles are cut along the line midway between the centres, so they meet and never
// overlap. Jump's reaches on into the view's bottom-right corner, away from Use: the rect from
// its centre to the corner, where a thumb reaching for it lands.
const RADIUS = TOUCH_CIRCLE_RADIUS + HINT_RADIUS;

// A drawn edge's distance in from the view's edge: edge in from the canvas's edge, less the bar
// between them, and at least CONTROL_VIEW_MARGIN.
function fromView(bar: number, edge: number): number {
  return Math.max(CONTROL_VIEW_MARGIN, edge - bar);
}

// Art's touch buttons, in base pixels of the view: each button's centre, where it is drawn, and
// the area a touch must start in to take it (hitAreas.ts).
type TouchButtons = Readonly<Record<TouchControl, { art: Rect; centre: Point; hit: PressShape }>>;

// Art's move hint, a drawing with no press area of its own (movement is the floating drag
// everywhere off the buttons): a ring in a frame the buttons' size, centred at rest on centre,
// and a knob that moves from the ring's centre at most knobReach pixels left or right the way
// the drag goes (TOUCH_LAYOUT).
interface MoveHint {
  readonly art: Rect;
  readonly centre: Point;
  readonly knobReach: number;
}

// The touch controls for one canvas: the buttons, their press areas for pressedArea, and the
// move hint.
export interface TouchLayout {
  readonly buttons: TouchButtons;
  readonly moveHint: MoveHint;
  readonly pressAreas: readonly PressArea<TouchControl>[];
}

// The touch controls in fit's canvas, in base pixels of the view (viewShift moves them into the
// canvas). Jump's drawn right edge sits CONTROL_SIDE in from the canvas's right and its bottom
// CONTROL_BOTTOM above the canvas's bottom, each at least CONTROL_VIEW_MARGIN inside the view;
// Use's centre is TOUCH_LAYOUT.useFromJump from Jump's, so it moves with Jump. At rest the move
// hint mirrors Jump: CONTROL_SIDE in from the canvas's left, at least CONTROL_VIEW_MARGIN inside
// the view, level with Jump.
export function touchLayout(fit: RenderFit): TouchLayout {
  const bars = viewBars(fit);
  const bottom = SCREEN.height - 1 - fromView(bars.bottom, CONTROL_BOTTOM) - DRAWN_HALF;
  const jumpCentre = {
    x: SCREEN.width - 1 - fromView(bars.right, CONTROL_SIDE) - DRAWN_HALF,
    y: bottom,
  };
  const useCentre = {
    x: jumpCentre.x + TOUCH_LAYOUT.useFromJump.x,
    y: jumpCentre.y + TOUCH_LAYOUT.useFromJump.y,
  };
  const hintCentre = { x: fromView(bars.left, CONTROL_SIDE) + DRAWN_HALF, y: bottom };
  const buttons: TouchButtons = {
    jump: {
      art: buttonArt(jumpCentre),
      centre: jumpCentre,
      hit: [
        { awayFrom: useCentre, centre: jumpCentre, radius: RADIUS },
        {
          height: SCREEN.height - jumpCentre.y,
          width: SCREEN.width - jumpCentre.x,
          x: jumpCentre.x,
          y: jumpCentre.y,
        },
      ],
    },
    use: {
      art: buttonArt(useCentre),
      centre: useCentre,
      hit: { awayFrom: jumpCentre, centre: useCentre, radius: RADIUS },
    },
  };
  return {
    buttons,
    moveHint: { art: buttonArt(hintCentre), centre: hintCentre, knobReach: TOUCH_LAYOUT.knobReach },
    pressAreas: (Object.keys(buttons) as TouchControl[]).map((key) => ({
      art: buttons[key].art,
      hit: buttons[key].hit,
      key,
    })),
  };
}
