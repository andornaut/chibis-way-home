import { START_SCREEN, TEXT_BUTTON } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { Point, Rect, Size } from "../../data/types";
import { hitAround } from "./hitAreas";
import { type LabelledButton, labelledButton } from "./restartCard";

// Art's start screen (art/README.md, Start screen), in base pixels (START_SCREEN): the nav bar
// across the top, with square icon buttons at its right end, each with its icon inset (sunk while
// pressed), and the logo with Start under it. With saved progress, Restart and Continue
// share Start's row instead, gap apart and centred under the logo. A button's label origin is 13
// below its top, 2 lower while pressed. Each button's press area, hit, is its drawn button grown
// by hitAreas.ts's rule.

const ICON_BUTTON = START_SCREEN.iconButton;
// A pressed button's icon or label sinks this far.
const PRESSED_SINK = START_SCREEN.pressedSink;
// The last icon button's x at the nav's right end; each one before it is a slot further left.
const RIGHT_BUTTON_X = START_SCREEN.rightIconX;
const BUTTON_SLOT = ICON_BUTTON.size + START_SCREEN.iconGap;
const START = { ...TEXT_BUTTON, ...START_SCREEN.start } as const;
// Continue and Restart's gap, side by side in Start's row.
const ROW_GAP = TEXT_BUTTON.gap;
const NAV_HEIGHT = START_SCREEN.navHeight;
const LOGO_TOP_GAP = START_SCREEN.logoTopGap;
const LOGO_ACTION_GAP = START_SCREEN.logoActionGap;

export interface IconButtonLayout {
  readonly art: Rect;
  readonly at: Point;
  readonly hit: Rect;
  readonly icon: Point;
  readonly pressedIcon: Point;
}

export interface StartScreenLayout {
  // Always present, immediately left of Settings.
  readonly achievements: IconButtonLayout;
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

// The start screen with Achievements, Settings then Exit at the nav's right end, or Achievements
// then Settings there where Exit is hidden; Start alone, or with saved progress, Restart then
// Continue. The natural logo frame fits above the unchanged actions at its original aspect ratio.
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
  const settingsSlot = exitShown ? 1 : 0;
  return {
    achievements: iconButton(settingsSlot + 1),
    ...(exitShown ? { exit: iconButton(0) } : {}),
    logo: {
      height: logoSize.height * scale,
      width: logoWidth,
      x: (SCREEN.width - logoWidth) / 2,
      y: logoY,
    },
    nav: { height: NAV_HEIGHT, width: SCREEN.width, x: 0, y: 0 },
    ...(saved ? { restart: labelledButton({ height, width, x: left, y }) } : {}),
    settings: iconButton(settingsSlot),
    start: labelledButton({ height, width, x: saved ? middle + ROW_GAP / 2 : x, y }),
  };
}
