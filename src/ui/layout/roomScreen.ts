import { ROOM_LAYOUT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { topBarFaceY } from "./topBar.ts";

const leaveY = topBarFaceY(TEXT_BUTTON.lipHeight, TEXT_BUTTON.height);
const { frameInset, frameLine, leaveRightInset } = ROOM_LAYOUT;
// The stroke is centred on the path. A full stroke width below Leave leaves half a stroke clear.
const frameY = leaveY + TEXT_BUTTON.height + frameLine;

export const ROOM_SCREEN = {
  frame: {
    height: SCREEN.height - frameInset - frameY,
    width: SCREEN.width - 2 * frameInset,
    x: frameInset,
    y: frameY,
  } satisfies Rect,
  leave: { rightInset: leaveRightInset, y: leaveY },
} as const;
