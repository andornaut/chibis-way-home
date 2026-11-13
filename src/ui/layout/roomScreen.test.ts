import { rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import buttonSheet from "../../../public/art/sprites/ui-button.json" with { type: "json" };
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";
import { ROOM_SCREEN } from "./roomScreen.ts";

const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const VIEW: Rect = { ...SCREEN, x: 0, y: 0 };

describe("the room screen", () => {
  const { frame, leave } = ROOM_SCREEN;

  it("draws Leave inside the view, at least as large as its 9-slice, clear of the pause button", () => {
    const { h, w } = Object.values(buttonSheet.frames)[0]?.sourceSize ?? { h: 0, w: 0 };
    expect({
      clear: rectsOverlap(leave.hit, PAUSE_BUTTON.hit),
      inside: inside(VIEW, leave.art),
      large: leave.art.width >= w && leave.art.height >= h,
    }).toEqual({ clear: false, inside: true, large: true });
  });

  it("keeps the placeholder frame inside the view and below Leave", () => {
    expect([inside(VIEW, frame), frame.y > leave.art.y + leave.art.height]).toEqual([true, true]);
  });
});
