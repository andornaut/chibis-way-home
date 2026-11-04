import type { Point, Rect } from "../../data/types";
import { hitAround } from "./hitAreas";

// A room, in base pixels in the game's view: Leave at the top right, level with the start
// screen's nav buttons and ending where they do, clear of the pause button's top-left corner;
// the room's name centred on nameCentre; and, for a room without art, a PLACEHOLDER frame below
// Leave. Leave is art's secondary button (ui-button, as Install), its label centred across it at
// its visible face, in at most room pixels. Its press area, hit, is the
// button grown by hitAreas.ts's rule.
const LEAVE_ART: Rect = { height: 28, width: 72, x: 640, y: 10 };

export const ROOM_SCREEN = {
  frame: { height: 288, width: 672, x: 24, y: 48 } satisfies Rect,
  leave: {
    art: LEAVE_ART,
    hit: hitAround(LEAVE_ART),
    room: 56,
  },
  nameCentre: { x: 360, y: 192 } satisfies Point,
} as const;
