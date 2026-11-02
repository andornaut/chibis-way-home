import { SCREEN } from "../data/screen";
import type { Point, Rect, Size } from "../data/types";
import { TEXT_BUTTON } from "./buttonLabel";
import { hitAround } from "./hitAreas";
import { type LabelledButton, labelledButton } from "./restartCard";

// Art's start screen (art/README.md, Start screen), in base pixels: the nav bar across the top,
// with 36x36 icon buttons at its right end, each with its 20x20 icon 8 in and 6 down (8 down
// while pressed), and the logo with Start under it. With saved progress, Restart and Continue
// share Start's row instead, gap apart and centred under the logo. A button's label origin is 13
// below its top, 2 lower while pressed. Each button's press area, hit, is its drawn button grown
// by hitAreas.ts's rule.

const ICON_BUTTON = { icon: { x: 8, y: 6 }, size: 36, y: 6 } as const;
// A pressed button's icon or label sinks this far.
const PRESSED_SINK = 2;
// The last icon button's x at the nav's right end; each one before it is a slot further left.
const RIGHT_BUTTON_X = 676;
const BUTTON_SLOT = 44;
const START = { ...TEXT_BUTTON, width: 192, x: 264, y: 268 } as const;
// Continue and Restart's gap, side by side in Start's row.
const ROW_GAP = TEXT_BUTTON.gap;
const NAV_HEIGHT = 48;
const LOGO_TOP_GAP = 12;
const LOGO_ACTION_GAP = 15;

export interface IconButtonLayout {
  readonly art: Rect;
  readonly at: Point;
  readonly hit: Rect;
  readonly icon: Point;
  readonly pressedIcon: Point;
}

export interface StartScreenLayout {
  // Present where the start screen offers to leave the game (exitShown in src/pwa).
  readonly exit?: IconButtonLayout;
  readonly logo: Rect;
  readonly nav: Rect;
  // Present with saved progress, beside Continue.
  readonly restart?: LabelledButton;
  readonly settings: IconButtonLayout;
  // Start, or with saved progress, Continue.
  readonly start: LabelledButton;
}

// The icon button in slot from the nav's right end, 0 the last.
function iconButton(slot: number): IconButtonLayout {
  const { icon, size, y } = ICON_BUTTON;
  const x = RIGHT_BUTTON_X - slot * BUTTON_SLOT;
  const art = { height: size, width: size, x, y };
  return {
    art,
    at: { x, y },
    hit: hitAround(art),
    icon: { x: x + icon.x, y: y + icon.y },
    pressedIcon: { x: x + icon.x, y: y + icon.y + PRESSED_SINK },
  };
}

// The start screen with Settings then Exit at the nav's right end, or Settings alone there where
// Exit is hidden; Start alone, or with saved progress, Restart then Continue. The natural logo
// frame fits above the unchanged actions at its original aspect ratio.
export function startScreenLayout(
  logoSize: Size,
  exitShown: boolean,
  saved: boolean,
): StartScreenLayout {
  const { height, width, x, y } = START;
  const middle = x + width / 2;
  const left = middle - width - ROW_GAP / 2;
  const logoY = NAV_HEIGHT + LOGO_TOP_GAP;
  const scale = Math.min(
    1,
    (SCREEN.width - 2 * TEXT_BUTTON.inset) / logoSize.width,
    (y - LOGO_ACTION_GAP - logoY) / logoSize.height,
  );
  const logoWidth = logoSize.width * scale;
  return {
    ...(exitShown ? { exit: iconButton(0) } : {}),
    logo: {
      height: logoSize.height * scale,
      width: logoWidth,
      x: (SCREEN.width - logoWidth) / 2,
      y: logoY,
    },
    nav: { height: NAV_HEIGHT, width: SCREEN.width, x: 0, y: 0 },
    ...(saved ? { restart: labelledButton({ height, width, x: left, y }) } : {}),
    settings: iconButton(exitShown ? 1 : 0),
    start: labelledButton({ height, width, x: saved ? middle + ROW_GAP / 2 : x, y }),
  };
}
