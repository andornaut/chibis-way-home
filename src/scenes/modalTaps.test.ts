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
  it.each<{
    closed: boolean;
    closes: boolean;
    down: Point;
    name: string;
    open: boolean;
    stopped: boolean;
    up?: Point;
  }>([
    {
      closed: true,
      closes: true,
      down: BESIDE,
      name: "on a card that can close, a tap beside the card closes it and reaches nothing under",
      open: true,
      stopped: true,
    },
    {
      closed: false,
      closes: true,
      down: onCanvas(ON_CARD),
      name: "on a card that can close, a tap on the card is the card's own",
      open: true,
      stopped: true,
    },
    {
      closed: true,
      closes: true,
      down: TOP_RIGHT,
      name:
        "on a card that can close, a tap at the screen's top right, where the start screen's " +
        "nav sits, closes it too",
      open: true,
      stopped: true,
    },
    {
      closed: false,
      closes: true,
      down: BESIDE,
      name: "closes on no drag past the tap distance, which still reaches nothing under",
      open: true,
      stopped: true,
      up: { x: BESIDE.x, y: BESIDE.y - TOUCH.tapMaxDistance - 1 },
    },
    {
      closed: false,
      closes: false,
      down: BESIDE,
      name: "leaves a card with no close open on a tap beside it, and nothing under responds",
      open: true,
      stopped: true,
    },
    {
      closed: false,
      closes: true,
      down: BESIDE,
      name: "leaves every press alone while no card shows",
      open: false,
      stopped: false,
    },
  ])("$name", ({ closed, closes, down, open, stopped, up }) => {
    expect(tap(open, closes, down, up)).toEqual({ closed, stopped });
  });
});
