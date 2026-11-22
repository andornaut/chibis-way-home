import { describe, expect, it } from "vitest";

import { ROOM_LAYOUT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { ROOM_SCREEN } from "./roomScreen.ts";
import { TOP_BAR_CENTRE_Y } from "./topBar.ts";

describe("the room screen", () => {
  const { frame, leave } = ROOM_SCREEN;

  it("centres the standard face above its lip and keeps Leave on the right navigation edge", () => {
    expect(leave.y).toBeGreaterThanOrEqual(0);
    expect(leave.y + (TEXT_BUTTON.height - TEXT_BUTTON.lipHeight) / 2).toBe(TOP_BAR_CENTRE_Y);
    expect(SCREEN.width - leave.rightInset).toBe(712);
  });

  it("clears the entire placeholder stroke without moving the side or bottom edges", () => {
    expect(frame.y - ROOM_LAYOUT.frameLine / 2).toBeGreaterThan(leave.y + TEXT_BUTTON.height);
    expect([frame.x, frame.x + frame.width, frame.y + frame.height]).toEqual([24, 696, 336]);
  });
});
