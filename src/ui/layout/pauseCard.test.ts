import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { hudDiscGeometry } from "@andornaut/game-kit/runtime/ui/hudDisc";
import { expect, it } from "vitest";

import { CONTROL_FRAME_INSET, HUD_EDGE } from "../../data/layout.ts";
import { HUD_DISC_SIZES, PAUSE_DISC } from "./controlChrome.ts";
import { arrangeEntry, ENTRY_ORIGIN, PAUSE_BUTTON } from "./pauseCard.ts";
import { TOP_BAR_CENTRE_Y } from "./topBar.ts";

it("puts the entry's frame on whole pixels, its disc HUD_EDGE from the view's left", () => {
  const { face } = hudDiscGeometry({ origin: ENTRY_ORIGIN }, HUD_DISC_SIZES.entry);
  expect(face).toEqual({ height: PAUSE_DISC.frame, width: PAUSE_DISC.frame, x: 11, y: 6 });
  expect(PAUSE_BUTTON.art).toEqual(face);
  expect(PAUSE_BUTTON.at).toEqual({ x: face.x, y: face.y });
  // The drawn disc is the frame less art's inset: its top at y 7, centred on the top section
  // with the spare pixel below.
  expect([face.x + CONTROL_FRAME_INSET, face.y + CONTROL_FRAME_INSET]).toEqual([HUD_EDGE, 7]);
  expect(TOP_BAR_CENTRE_Y - face.y - face.height / 2).toBe(0.5);
});

it("gives the entry, alone in its group, the kit's press area about its face", () => {
  const [entry] = arrangeEntry("entry").actions;
  if (entry === undefined || entry.hidden) {
    throw new Error("The entry has no place");
  }
  const { face, outset, press } = entry;
  expect(face).toEqual(PAUSE_BUTTON.art);
  expect(press).toEqual(PAUSE_BUTTON.hit);
  expect([outset.top, outset.right, outset.bottom, outset.left]).toEqual([9, 9, 9, 9]);
  expect(press).toEqual({ height: 53, width: 53, x: 2, y: -3 });
  expect(Math.min(press.width, press.height)).toBeGreaterThanOrEqual(HIT_RULE.minTarget);
});

it("moves the entry with the view", () => {
  const [entry] = arrangeEntry("entry", {
    x: ENTRY_ORIGIN.x + 150,
    y: ENTRY_ORIGIN.y + 60,
  }).actions;
  expect(entry).toMatchObject({
    face: { x: PAUSE_BUTTON.art.x + 150, y: PAUSE_BUTTON.art.y + 60 },
  });
});
