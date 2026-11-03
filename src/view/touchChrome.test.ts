import { expect, it } from "vitest";

import palette from "../../public/art/palette.json";
import {
  type TouchChromeKind,
  touchChromeLayers,
  touchChromePixel,
  type TouchChromePose,
} from "./touchChrome";

const colours = {
  cream: parseInt(palette.colours.cream.slice(1), 16),
  ink: parseInt(palette.colours.ink.slice(1), 16),
  white: parseInt(palette.colours.white.slice(1), 16),
};
function sample(
  kind: TouchChromeKind,
  pose: TouchChromePose,
  x: number,
  y: number,
  expanded = false,
) {
  const [r, g, b, a] = touchChromePixel(touchChromeLayers(colours, kind, pose, expanded), { x, y });
  return { alpha: a, colour: (r << 16) | (g << 8) | b };
}
it.each<TouchChromeKind>(["use", "jump", "move"])(
  "keeps %s open inside opaque ring bands with fractional edge coverage",
  (kind) => {
    expect(sample(kind, "rest", 37.5, 51).alpha).toBe(0);
    expect(sample(kind, "rest", 74.5, 37.5).alpha).toBe(0);
    expect(sample(kind, "rest", 74, 37.5).alpha).toBeGreaterThan(0);
    expect(sample(kind, "rest", 74, 37.5).alpha).toBeLessThan(255);
    expect(sample(kind, "rest", 72, 37.5)).toEqual({ alpha: 255, colour: colours.cream });
    expect(sample(kind, "rest", 69.5, 37.5)).toEqual({ alpha: 255, colour: colours.ink });
    expect(sample(kind, "press", 74.5, 37.5, true).alpha).toBe(255);
  },
);
it("centres round Use dots and preserves the white press core", () => {
  for (const x of [28.5, 37.5, 46.5]) {
    expect(sample("use", "held", x, 37.5)).toEqual({ alpha: 255, colour: colours.white });
  }
  expect(sample("use", "rest", 28.5, 42).colour).toBe(colours.ink);
  expect(sample("jump", "held", 37.5, 33)).toEqual({ alpha: 255, colour: colours.white });
});
it("lights only the dragged Move chevron while keeping its ring cream", () => {
  expect(sample("move", "held-left", 13, 37.5).colour).toBe(colours.white);
  expect(sample("move", "held-left", 62, 37.5).colour).toBe(colours.cream);
  expect(sample("move", "held-right", 13, 37.5).colour).toBe(colours.cream);
  expect(sample("move", "held-right", 62, 37.5).colour).toBe(colours.white);
  expect(sample("move", "held-left", 72, 37.5).colour).toBe(colours.cream);
  expect(sample("knob", "held", 5.5, 5.5).colour).toBe(colours.white);
});
