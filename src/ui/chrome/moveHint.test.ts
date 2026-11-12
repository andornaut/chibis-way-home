import { describe, expect, it } from "vitest";

import hintSheet from "../../../public/art/sprites/ui-move-hint.json" with { type: "json" };
import { TOUCH } from "../../data/touch.ts";
import type { Point } from "../../data/types/index.ts";
import type { HeldTouch } from "../input/intent.ts";
import { MOVE_HINT } from "../layout/touchControls.ts";
import { knobOffset, moveHintView } from "./moveHint.ts";
import { centredAt } from "./touchControls.ts";

const { knobReach } = MOVE_HINT;
const REST = MOVE_HINT.centre;
const DEAD = TOUCH.moveDeadZone;

const touch = (role: HeldTouch["role"], start: Point, at: Point): HeldTouch => ({
  role,
  startX: start.x,
  startY: start.y,
  x: at.x,
});
const START = { x: 200, y: 250 };

describe("the move hint at rest", () => {
  it("draws art's frame at its top-left", () => {
    const { h, w } = Object.values(hintSheet.frames)[0]?.frame ?? { h: 0, w: 0 };
    expect(centredAt(MOVE_HINT.centre, { height: h, width: w })).toEqual({
      x: MOVE_HINT.art.x,
      y: MOVE_HINT.art.y,
    });
  });
});

describe("moveHintView", () => {
  const atRest = { centre: REST, knob: REST, knobTag: "rest", ringTag: "rest" };

  it.each<[string, HeldTouch[], object]>([
    ["no touch: at rest", [], atRest],
    ["a button held: at rest", [touch("jump", START, START)], atRest],
    [
      "a drag right: on its start, held right, the knob at its reach",
      [touch("move", START, { x: START.x + 30, y: START.y })],
      {
        centre: START,
        knob: { x: START.x + knobReach, y: START.y },
        knobTag: "held",
        ringTag: "held-right",
      },
    ],
    [
      "a drag left: held left",
      [touch("move", START, { x: START.x - 30, y: START.y })],
      {
        centre: START,
        knob: { x: START.x - knobReach, y: START.y },
        knobTag: "held",
        ringTag: "held-left",
      },
    ],
    [
      "a drag inside the dead zone: the ring at rest on its start, the knob followed",
      [touch("move", START, { x: START.x + DEAD, y: START.y })],
      { centre: START, knob: { x: START.x + DEAD, y: START.y }, knobTag: "held", ringTag: "rest" },
    ],
    [
      "two drags: the later one",
      [
        touch("move", { x: 100, y: 200 }, { x: 70, y: 200 }),
        touch("move", START, { x: START.x + 30, y: START.y }),
      ],
      {
        centre: START,
        knob: { x: START.x + knobReach, y: START.y },
        knobTag: "held",
        ringTag: "held-right",
      },
    ],
  ])("%s", (_, touches, view) => {
    expect(moveHintView(TOUCH, knobReach, REST, touches)).toEqual(view);
  });
});

describe("knobOffset", () => {
  it.each([
    [5, 5],
    [100, knobReach],
    [-100, -knobReach],
  ])("moves the knob %i across by %i", (dx, offset) => {
    expect(knobOffset(knobReach, dx)).toBe(offset);
  });
});
