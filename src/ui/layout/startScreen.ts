import { START_SCREEN, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect, Size } from "../../data/types/index.ts";
import { PAUSE_DISC } from "./controlChrome.ts";
import { type LabelledButton, labelledButton } from "./labelledButton.ts";
import { TOP_BAR_CENTRE_Y } from "./topBar.ts";

// Start uses the shared navigation disc and keeps Exit's established press area.
const START = { ...TEXT_BUTTON, ...START_SCREEN.start } as const;
// Continue and Restart's gap, side by side in Start's row.
const ROW_GAP = TEXT_BUTTON.gap;
const NAV_HEIGHT = START_SCREEN.navHeight;
const LOGO_TOP_GAP = START_SCREEN.logoTopGap;
const LOGO_ACTION_GAP = START_SCREEN.logoActionGap;

export interface IconButtonLayout {
  readonly art: Rect;
  readonly hit: Rect;
}

export interface StartScreenLayout {
  // Present where Exit closes the app (exitShown in src/pwa).
  readonly exit?: IconButtonLayout;
  readonly logo: Rect;
  readonly nav: Rect;
  // Present with saved progress, beside Continue.
  readonly restart?: LabelledButton;
  // Start, or with saved progress, Continue.
  readonly start: LabelledButton;
}

function exitButton(): IconButtonLayout {
  const { exitCentreX: x, exitTarget: target } = START_SCREEN;
  const size = PAUSE_DISC.frame;
  return {
    art: { height: size, width: size, x: x - size / 2, y: TOP_BAR_CENTRE_Y - size / 2 },
    hit: { height: target, width: target, x: x - target / 2, y: 0 },
  };
}

// The start screen with Exit at the nav's right end where supported;
// Start alone, or with saved progress, Restart then
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
  return {
    ...(exitShown ? { exit: exitButton() } : {}),
    logo: {
      height: logoSize.height * scale,
      width: logoWidth,
      x: (SCREEN.width - logoWidth) / 2,
      y: logoY,
    },
    nav: { height: NAV_HEIGHT, width: SCREEN.width, x: 0, y: 0 },
    ...(saved ? { restart: labelledButton({ height, width, x: left, y }) } : {}),
    start: labelledButton({ height, width, x: saved ? middle + ROW_GAP / 2 : x, y }),
  };
}
