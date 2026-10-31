import { EventEmitter } from "node:events";

import type { Input, Scene } from "phaser";
import { describe, expect, it } from "vitest";

import { TOUCH } from "../data/touch";
import type { Point } from "../data/types";
import { catchModalTaps } from "./modalTaps";

// A 400x200 canvas, the card's view 40 in from its left: a card at 100,50 in the view, 100x60.
const VIEW: Point = { x: 40, y: 0 };
const CARD = { height: 60, width: 100, x: 100, y: 50 };
const ON_CARD = { x: 150, y: 70 };
const TOP_RIGHT = { x: 370, y: 10 };
const BESIDE = { x: 20, y: 150 };

// Plays a press from down to up with the card open or not, and reports whether it closed and
// whether the press was kept from the scenes under the card's.
function tap(open: boolean, closes: boolean, down: Point, up: Point = down) {
  const listeners = new Map<string, (pointer: Input.Pointer) => void>();
  let stopped = false;
  const input = {
    on: (event: string, listener: (pointer: Input.Pointer) => void) => {
      listeners.set(event, listener);
    },
    stopPropagation: () => {
      stopped = true;
    },
  };
  let closed = 0;
  const scene = {
    events: new EventEmitter(),
    game: {},
    input,
    scale: { gameSize: { height: 200, width: 400 } },
  } as unknown as Scene;
  catchModalTaps(scene, VIEW, {
    ...(closes && {
      close: () => {
        closed++;
      },
    }),
    covered: () => (open ? [CARD] : undefined),
  });
  const pointer = (at: Point) => ({ id: 1, wasCanceled: false, ...at }) as unknown as Input.Pointer;
  listeners.get("pointerdown")?.(pointer(down));
  listeners.get("pointermove")?.(pointer(up));
  listeners.get("pointerup")?.(pointer(up));
  return { closed: closed > 0, stopped };
}

const onCanvas = (view: Point): Point => ({ x: view.x + VIEW.x, y: view.y + VIEW.y });

describe("catchModalTaps", () => {
  it.each([
    ["beside the card closes it and reaches nothing under", BESIDE, true, true],
    ["on the card is the card's own", onCanvas(ON_CARD), false, true],
    [
      "at the screen's top right, where the start screen's nav sits, closes it too",
      TOP_RIGHT,
      true,
      true,
    ],
  ])("on a card that can close, a tap %s", (_, at, closed, stopped) => {
    expect(tap(true, true, at)).toEqual({ closed, stopped });
  });

  it("closes on no drag past the tap distance, which still reaches nothing under", () => {
    const far = { x: BESIDE.x, y: BESIDE.y - TOUCH.tapMaxDistance - 1 };
    expect(tap(true, true, BESIDE, far)).toEqual({ closed: false, stopped: true });
  });

  it("leaves a card with no close open on a tap beside it, and nothing under responds", () => {
    expect(tap(true, false, BESIDE)).toEqual({ closed: false, stopped: true });
  });

  it("leaves every press alone while no card shows", () => {
    expect(tap(false, true, BESIDE)).toEqual({ closed: false, stopped: false });
  });
});
