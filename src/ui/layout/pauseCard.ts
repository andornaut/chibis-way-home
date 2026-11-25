import { type ActionArrangement, arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { hudDiscGeometry } from "@andornaut/game-kit/runtime/ui/hudDisc";

import { HUD_EDGE } from "../../data/layout.ts";
import type { Point, Rect } from "../../data/types/index.ts";
import { HUD_DISC_SIZES, PAUSE_DISC } from "./controlChrome.ts";
import { topBarDiscY } from "./topBar.ts";

// The Pause or Menu entry in the view's top-left corner: one HUD disc, its face art's frame, as
// the sole action of its own group. The drawn disc is HUD_EDGE in from the view's left and
// centred on the top section, on whole pixels.
const SIZE = HUD_DISC_SIZES.entry;

// The group's top-left corner in the base view, which is the face's.
export const ENTRY_ORIGIN: Point = {
  x: HUD_EDGE - PAUSE_DISC.inset,
  y: topBarDiscY(SIZE.face),
};

// The group's room across: its one face.
export const ENTRY_WIDTH = SIZE.face;

// The entry's arrangement about origin: its face, and its press area by the kit's hit rule.
export function arrangeEntry<K>(key: K, origin: Point = ENTRY_ORIGIN): ActionArrangement<K> {
  return arrangeActions({ axis: "row", origin, width: ENTRY_WIDTH }, [
    { key, role: "navigation", size: { height: SIZE.face, width: SIZE.face } },
  ]);
}

const placed = arrangeEntry("entry").actions[0]!;
if (placed.hidden) {
  throw new Error("The entry disc has no place");
}

// Where the entry's frame is drawn, and the area a press must land in.
export const PAUSE_BUTTON = {
  art: hudDiscGeometry({ origin: ENTRY_ORIGIN }, SIZE).face satisfies Rect,
  at: ENTRY_ORIGIN,
  hit: placed.press satisfies Rect,
} as const;
