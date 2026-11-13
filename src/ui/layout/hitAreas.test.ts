import { HIT_RULE } from "@andornaut/game-kit/ui/hitAreas";
import { renderFit } from "@andornaut/game-kit/view/renderScale";
import { describe, expect, it } from "vitest";

import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { hitAround, hitMargin, type PressArea, pressedArea } from "./hitAreas.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";
import { startScreenLayout } from "./startScreen.ts";
import { touchLayout } from "./touchControls.ts";

const square = (side: number) => ({ height: side, width: side, x: 100, y: 100 });

describe("hitMargin", () => {
  it.each([
    ["a quarter of a mid-sized button's shorter side", { height: 40, width: 200, x: 0, y: 0 }, 10],
    ["no less than the least margin", square(16), HIT_RULE.leastMargin],
    ["no more than the most margin", square(200), HIT_RULE.mostMargin],
  ])("is %s", (_, art, margin) => {
    expect(hitMargin(art)).toBe(margin);
  });
});

describe("hitAround", () => {
  // Each button's press area, by the rule, from its drawn size.
  const { start } = startScreenLayout(SCREEN, true, false);
  it.each<[string, { height: number; width: number }, { height: number; width: number }]>([
    ["the pause button, a 35 px frame", PAUSE_BUTTON.art, { height: 52.5, width: 52.5 }],
    ["a 16 px icon, at the least size", square(16), { height: 48, width: 48 }],
    ["a standard action button", { height: 48, width: 192 }, { height: 72, width: 216 }],
    ["Start", start.button, { height: 72, width: 216 }],
    [
      "a nav icon button",
      startScreenLayout(SCREEN, true, false).achievements.art,
      { height: 54, width: 54 },
    ],
  ])("grows %s", (_, art, size) => {
    const hit = hitAround({ ...art, x: 0, y: 0 });
    expect({ height: hit.height, width: hit.width }).toEqual(size);
  });

  it("grows a small button evenly about its centre to the least size", () => {
    const art = square(16);
    const hit = hitAround(art);
    expect({
      centre: { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 },
      size: hit.width,
    }).toEqual({ centre: { x: 108, y: 108 }, size: HIT_RULE.minTarget });
  });
});

describe("pressedArea", () => {
  // Two 40 px tall buttons side by side, each grown by 10 (a quarter of 40), overlapping by 20.
  const button = (key: string, art: Rect): PressArea<string> => ({ art, hit: hitAround(art), key });
  const LEFT = button("left", { height: 40, width: 50, x: 0, y: 0 });
  const RIGHT = button("right", { height: 40, width: 50, x: 50, y: 0 });
  it.each([
    ["just inside the left margin", { x: -10, y: 20 }, "left"],
    ["just outside the left margin", { x: -11, y: 20 }, undefined],
    ["just inside the top margin", { x: 25, y: -10 }, "left"],
    ["just outside the top margin", { x: 25, y: -11 }, undefined],
    ["just inside the bottom margin", { x: 25, y: 49 }, "left"],
    ["just outside the bottom margin", { x: 25, y: 50 }, undefined],
    ["just inside the right margin", { x: 109, y: 20 }, "right"],
    ["just outside the right margin", { x: 110, y: 20 }, undefined],
    ["in the overlap, nearer the left button", { x: 49, y: 20 }, "left"],
    ["in the overlap, nearer the right button", { x: 51, y: 20 }, "right"],
  ])("takes a press %s as %s", (_, point, key) => {
    expect(pressedArea([LEFT, RIGHT], point)).toBe(key);
  });

  it("keeps the screen's bottom-right corner in Jump's area", () => {
    const { jump } = touchLayout(renderFit(SCREEN, 1, SCREEN)).buttons;
    expect(pressedArea([{ ...jump, key: "jump" }], { x: 719, y: 359 })).toBe("jump");
  });
});

describe("a circle cut away from a point", () => {
  // Circles of radius 100 about centres 100 apart, each cut toward the other.
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };
  const art = { height: 1, width: 1, x: 0, y: 0 };
  const areas = [
    { art, hit: { awayFrom: b, centre: a, radius: 100 }, key: "a" },
    { art: { ...art, x: 100 }, hit: { awayFrom: a, centre: b, radius: 100 }, key: "b" },
  ];
  it.each<[string, { x: number; y: number }, string | undefined]>([
    ["just short of the midline, on a's side", { x: 49.9, y: 0 }, "a"],
    ["just past the midline, on b's side", { x: 50.1, y: 0 }, "b"],
    ["on the midline, nearer neither", { x: 50, y: 0 }, undefined],
    ["inside a's radius and past b, but nearer b", { x: 95, y: 0 }, "b"],
    ["outside both radii", { x: 50, y: 90 }, undefined],
  ])("takes a press %s as %s", (_, point, key) => {
    expect(pressedArea(areas, point)).toBe(key);
  });

  it("never takes a press into both", () => {
    const both = [
      { x: 30, y: 20 },
      { x: 70, y: -20 },
      { x: 50, y: 50 },
    ].filter((point) => areas.every(({ hit }) => pressedArea([{ art, hit, key: 1 }], point)));
    expect(both).toEqual([]);
  });
});
