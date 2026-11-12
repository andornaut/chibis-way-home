import type { OpeningBeat, OpeningLayer, Point } from "./types/index.ts";

function stillSprite(anchor: Point, flipX: boolean, position: Point, art: string): OpeningLayer {
  return {
    anchor,
    art,
    flipX,
    keyframes: [0, 1].map((progress) => ({
      angle: 0,
      pose: "idle",
      position,
      progress,
      scale: 1,
      visible: true,
    })),
  };
}

const chibi = (x: number) => stillSprite({ x: 24, y: 42 }, false, { x, y: 240 }, "bird");
const fert = (x: number) => stillSprite({ x: 24, y: 48 }, true, { x, y: 240 }, "ferret-antagonist");
const parcel = (x: number) => stillSprite({ x: 12, y: 24 }, false, { x, y: 240 }, "ferret-parcel");

// Every beat waits for Continue, including after its single shot reaches its final pose.
export const OPENING: readonly OpeningBeat[] = [
  {
    shots: [{ background: null, layers: [chibi(240), fert(480)], seconds: 1 }],
    text: "opening-friendship",
  },
  {
    shots: [{ background: null, layers: [chibi(240), fert(480)], seconds: 1 }],
    text: "opening-argument",
  },
  {
    shots: [{ background: null, layers: [parcel(360), fert(480)], seconds: 1 }],
    text: "opening-packing",
  },
  {
    shots: [{ background: null, layers: [parcel(360), chibi(240)], seconds: 1 }],
    text: "opening-waking",
  },
];
