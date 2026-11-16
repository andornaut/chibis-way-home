import { ROOM_LAYOUT, TEXT_BUTTON } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";
import { topBarButton } from "./topBar.ts";

// A room, in base pixels in the game's view: Leave at the top right, level with the start
// screen's nav buttons and ending where they do, clear of the pause button's top-left corner;
// the room's name centred on nameCentre; and, for a room without art, a PLACEHOLDER frame below
// Leave (ROOM_LAYOUT). Leave is art's secondary button (ui-button, as Install), its label centred
// across it at its visible face, in at most room pixels. Its press area, hit, is the button grown
// by hitAreas.ts's rule.
const leave = topBarButton(TEXT_BUTTON.lipHeight, ROOM_LAYOUT.leave satisfies Rect);

export const ROOM_SCREEN = {
  frame: ROOM_LAYOUT.frame,
  leave: {
    ...leave,
    room: ROOM_LAYOUT.leaveRoom,
  },
  nameCentre: ROOM_LAYOUT.nameCentre,
} as const;
