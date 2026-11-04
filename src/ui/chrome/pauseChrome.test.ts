import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json";
import { PAUSE_BUTTON } from "../layout/pauseCard";
import { pauseChromeLayers, type PauseChromePose } from "./pauseChrome";
import { touchChromePixel } from "./touchChrome";

const colour = (key: keyof typeof palette.colours) => parseInt(palette.colours[key].slice(1), 16);
const colours = {
  cream: colour("cream"),
  dslate: colour("dslate"),
  ink: colour("ink"),
  navy: colour("navy"),
  white: colour("white"),
};
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
      const [r, g, b, alpha] = touchChromePixel(layers, { x, y });
      return { alpha, colour: (r << 16) | (g << 8) | b };
    };
    expect(sample(17.5, 17.5)).toEqual({ alpha: 255, colour: face });
    expect(sample(12.125, 11.125)).toEqual({ alpha: 255, colour: ring });
    expect(sample(22.875, 23.875)).toEqual({ alpha: 255, colour: ring });
    expect(sample(16.125, 17.5).colour).toBe(face);
    const edge = touchChromePixel(layers, { x: 17.5 + (expanded ? 17.5 : 16.5), y: 17.5 })[3];
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(sample(0.125, 0.125).alpha).toBe(0);
  },
);

it("retains the existing 52.5px Pause target", () => {
  expect(PAUSE_BUTTON.hit.width).toBe(52.5);
  expect(PAUSE_BUTTON.hit.height).toBe(52.5);
});
