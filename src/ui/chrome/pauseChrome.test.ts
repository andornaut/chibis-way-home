import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json";
import { PAUSE_BUTTON } from "../layout/pauseCard";
import { PAUSE_CHROME_FRAME, pauseChromeLayers, type PauseChromePose } from "./pauseChrome";
import { touchChromePixel } from "./touchChrome";

const colour = (key: keyof typeof palette.colours) => parseInt(palette.colours[key].slice(1), 16);
const colours = {
  cream: colour("cream"),
  dslate: colour("dslate"),
  ink: colour("ink"),
  navy: colour("navy"),
  white: colour("white"),
};
const rgb = (value: number) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];
it.each<{ pose: PauseChromePose; expanded: boolean; face: number; ring: number }>([
  { expanded: false, face: colours.navy, pose: "rest", ring: colours.cream },
  { expanded: true, face: colours.dslate, pose: "press", ring: colours.white },
  { expanded: false, face: colours.dslate, pose: "press", ring: colours.white },
  { expanded: false, face: colours.dslate, pose: "held", ring: colours.white },
])(
  "paints opaque $pose face and rectangular bars with fractional circle edges",
  ({ expanded, face, pose, ring }) => {
    const layers = pauseChromeLayers(colours, pose, expanded);
    const sample = (x: number, y: number) => {
      const [r, g, b, alpha] = touchChromePixel(4, layers, { x, y });
      return { alpha, colour: (r << 16) | (g << 8) | b };
    };
    expect(sample(17.5, 17.5)).toEqual({ alpha: 255, colour: face });
    expect(sample(12.125, 11.125)).toEqual({ alpha: 255, colour: ring });
    expect(sample(22.875, 23.875)).toEqual({ alpha: 255, colour: ring });
    expect(sample(16.125, 17.5).colour).toBe(face);
    const edge = touchChromePixel(4, layers, { x: 17.5 + (expanded ? 17.5 : 16.5), y: 17.5 })[3];
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(sample(0.125, 0.125).alpha).toBe(0);
  },
);

it("retains the existing 52.5px Pause target", () => {
  expect(PAUSE_BUTTON.hit.width).toBe(52.5);
  expect(PAUSE_BUTTON.hit.height).toBe(52.5);
});

it("keeps the 35px disc, 1px ring and two 4x13 bars at every texel scale", () => {
  const centre = { x: 17.5, y: 17.5 };
  expect(PAUSE_CHROME_FRAME).toBe(35);
  expect(pauseChromeLayers(colours, "rest", false)).toEqual([
    { centre, colour: colours.ink, kind: "disc", radius: 16.5 },
    { centre, colour: colours.cream, kind: "disc", radius: 15.5 },
    { centre, colour: colours.navy, kind: "disc", radius: 13.5 },
    { colour: colours.cream, kind: "rect", rect: { height: 13, width: 4, x: 12, y: 11 } },
    { colour: colours.cream, kind: "rect", rect: { height: 13, width: 4, x: 19, y: 11 } },
  ]);
  const layers = pauseChromeLayers(colours, "rest", false);
  for (const scale of [1, 2.67, 3.25, 4]) {
    // Each edge blends within one texel: opaque half a texel inside, clear half a texel out.
    expect(touchChromePixel(scale, layers, { x: 12 + 0.5 / scale, y: 17.5 })).toEqual([
      ...rgb(colours.cream),
      255,
    ]);
    expect(touchChromePixel(scale, layers, { x: 12 - 0.5 / scale, y: 17.5 })).toEqual([
      ...rgb(colours.navy),
      255,
    ]);
    expect(touchChromePixel(scale, layers, { x: 34 + 0.5 / scale, y: 17.5 })[3]).toBe(0);
    expect(touchChromePixel(scale, layers, { x: 34 - 0.5 / scale, y: 17.5 })[3]).toBe(255);
  }
});
