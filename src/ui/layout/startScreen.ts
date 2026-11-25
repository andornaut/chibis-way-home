import { START_SCREEN, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect, Size } from "../../data/types/index.ts";
import { PAUSE_DISC } from "./controlChrome.ts";
import { hitMargin } from "./hitAreas.ts";
import { TOP_BAR_CENTRE_Y } from "./topBar.ts";

// Start uses the shared navigation disc. Exit's frame sits on whole pixels, centred on the top
// section to the pixel above; its press area is the frame grown by the hit rule's margin, in
// whole pixels, and held below the view's top.
const NAV_HEIGHT = START_SCREEN.navHeight;
const LOGO_TOP_GAP = START_SCREEN.logoTopGap;
const LOGO_ACTION_GAP = START_SCREEN.logoActionGap;

export interface IconButtonLayout {
  readonly art: Rect;
  readonly hit: Rect;
}

export interface StartScreenLayout {
  readonly actionY: number;
  // Present where Exit closes the app (exitShown in src/pwa).
  readonly exit?: IconButtonLayout;
  readonly logo: Rect;
  readonly nav: Rect;
  readonly saved: boolean;
}

function exitButton(): IconButtonLayout {
  const size = PAUSE_DISC.frame;
  const art = {
    height: size,
    width: size,
    x: START_SCREEN.exitX,
    y: Math.floor(TOP_BAR_CENTRE_Y - size / 2),
  };
  const margin = Math.ceil(hitMargin(art));
  const target = size + 2 * margin;
  return {
    art,
    hit: { height: target, width: target, x: art.x - margin, y: Math.max(0, art.y - margin) },
  };
}

// The start screen shows Exit where supported. The logo fits above the action row at its
// natural aspect ratio.
export function startScreenLayout(
  logoSize: Size,
  exitShown: boolean,
  saved: boolean,
): StartScreenLayout {
  const { actionY } = START_SCREEN;
  const logoY = NAV_HEIGHT + LOGO_TOP_GAP;
  const scale = Math.min(
    1,
    (SCREEN.width - 2 * TEXT_BUTTON.inset) / logoSize.width,
    (actionY - LOGO_ACTION_GAP - logoY) / logoSize.height,
  );
  const logoWidth = logoSize.width * scale;
  return {
    actionY,
    ...(exitShown ? { exit: exitButton() } : {}),
    logo: {
      height: logoSize.height * scale,
      width: logoWidth,
      x: (SCREEN.width - logoWidth) / 2,
      y: logoY,
    },
    nav: { height: NAV_HEIGHT, width: SCREEN.width, x: 0, y: 0 },
    saved,
  };
}
