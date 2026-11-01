import art from "../../art/opening/contract.json";
import type { OpeningBeat, OpeningKeyframe, OpeningLayer, Point } from "./types";

function keyframe(progress: number, position: Point, pose: string): OpeningKeyframe {
  return { angle: 0, pose, position, progress, scale: 1, visible: true };
}

function layer(artKey: string, keyframes: readonly OpeningKeyframe[]): OpeningLayer {
  return { anchor: art.anchor, art: artKey, keyframes };
}

const PACKING_PARCEL = [
  keyframe(0, { x: 358, y: 270 }, "open"),
  keyframe(0.66, { x: 358, y: 270 }, "half-closed"),
  keyframe(0.82, { x: 358, y: 270 }, "sealed"),
  keyframe(1, { x: 358, y: 270 }, "sealed"),
];
const WAKING_PARCEL = [
  keyframe(0, { x: 360, y: 270 }, "sealed"),
  keyframe(0.12, { x: 360, y: 270 }, "half-closed"),
  keyframe(0.24, { x: 360, y: 270 }, "opened"),
  keyframe(1, { x: 360, y: 270 }, "opened"),
];

// Each beat waits for Continue; shot durations control animation, never input availability.
export const OPENING: readonly OpeningBeat[] = [
  {
    shots: [
      {
        background: art.backgrounds.home,
        layers: [
          layer("opening-chibi", [
            keyframe(0, { x: 244, y: 270 }, "rest"),
            { ...keyframe(0.25, { x: 244, y: 270 }, "rest"), scale: 1.012 },
            keyframe(0.44, { x: 244, y: 270 }, "blink"),
            keyframe(0.49, { x: 244, y: 270 }, "rest"),
            { ...keyframe(0.75, { x: 244, y: 270 }, "rest"), scale: 1.012 },
            keyframe(1, { x: 244, y: 270 }, "rest"),
          ]),
          layer("opening-ferret", [
            keyframe(0, { x: 466, y: 270 }, "friendly"),
            keyframe(0.26, { x: 466, y: 270 }, "gesture"),
            keyframe(0.68, { x: 466, y: 270 }, "friendly"),
            keyframe(1, { x: 466, y: 270 }, "friendly"),
          ]),
        ],
        seconds: 2.4,
      },
    ],
    text: "opening-friendship",
  },
  {
    shots: [
      {
        background: art.backgrounds.home,
        layers: [
          layer("opening-chibi", [
            keyframe(0, { x: 244, y: 270 }, "rest"),
            keyframe(0.5, { x: 228, y: 270 }, "rest"),
            keyframe(0.7, { x: 228, y: 270 }, "blink"),
            keyframe(1, { x: 228, y: 270 }, "rest"),
          ]),
          layer("opening-ferret", [
            keyframe(0, { x: 452, y: 270 }, "argument"),
            { ...keyframe(0.5, { x: 452, y: 270 }, "argument"), angle: 2 },
            keyframe(1, { x: 452, y: 270 }, "argument"),
          ]),
        ],
        seconds: 1.6,
      },
    ],
    text: "opening-argument",
  },
  {
    shots: [
      {
        background: art.backgrounds.home,
        layers: [
          layer("opening-parcel", PACKING_PARCEL),
          layer("opening-ferret", [
            keyframe(0, { x: 458, y: 270 }, "pack"),
            { ...keyframe(0.5, { x: 450, y: 270 }, "pack"), angle: -2 },
            keyframe(1, { x: 458, y: 270 }, "pack"),
          ]),
          layer("opening-chibi", [
            keyframe(0, { x: 260, y: 238 }, "sleep"),
            { ...keyframe(0.3, { x: 309, y: 208 }, "sleep"), scale: 1.012 },
            keyframe(0.6, { x: 358, y: 238 }, "sleep"),
            { ...keyframe(0.82, { x: 358, y: 238 }, "sleep"), visible: false },
            { ...keyframe(1, { x: 358, y: 238 }, "sleep"), visible: false },
          ]),
          layer("opening-parcel-front", PACKING_PARCEL),
        ],
        seconds: 2,
      },
      {
        background: art.backgrounds.transit,
        layers: [
          layer("opening-parcel", [
            keyframe(0, { x: -110, y: 236 }, "sealed"),
            { ...keyframe(0.25, { x: 125, y: 240 }, "sealed"), angle: 2 },
            keyframe(0.5, { x: 360, y: 236 }, "sealed"),
            { ...keyframe(0.75, { x: 595, y: 232 }, "sealed"), angle: -2 },
            keyframe(1, { x: 830, y: 236 }, "sealed"),
          ]),
        ],
        seconds: 1.6,
      },
    ],
    text: "opening-packing",
  },
  {
    shots: [
      {
        background: art.backgrounds.depot,
        layers: [
          layer("opening-parcel", WAKING_PARCEL),
          layer("opening-chibi", [
            { ...keyframe(0, { x: 360, y: 234 }, "sleep"), visible: false },
            keyframe(0.24, { x: 360, y: 234 }, "sleep"),
            keyframe(0.42, { x: 360, y: 234 }, "wake"),
            { ...keyframe(0.64, { x: 360, y: 219 }, "rest"), scale: 1.012 },
            keyframe(1, { x: 360, y: 214 }, "rest"),
          ]),
          layer("opening-parcel-front", WAKING_PARCEL),
        ],
        seconds: 2,
      },
    ],
    text: "opening-waking",
  },
];
