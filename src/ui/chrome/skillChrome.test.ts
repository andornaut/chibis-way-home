import { expect, it } from "vitest";

import { SKILL_BUTTON } from "../layout/skillHud";
import { skillChromeLayers } from "./skillChrome";
import { touchChromePixel } from "./touchChrome";

const colours = { face: 0x223344, ink: 0x181425 };

it("keeps the 33px circle and the selected 4px annulus in the 48px target", () => {
  const centre = { x: 24, y: 24 };
  expect(SKILL_BUTTON).toEqual({ disc: 33, glyph: 16, target: 48 });
  expect(skillChromeLayers(colours, false)).toEqual([
    { centre, colour: colours.face, kind: "disc", radius: 16.5 },
  ]);
  expect(skillChromeLayers(colours, true)).toEqual([
    { centre, colour: colours.ink, kind: "disc", radius: 16.5 },
    { centre, colour: colours.face, kind: "disc", radius: 12.5 },
  ]);
});

it("blends the circle edge within one texel at every texel scale", () => {
  for (const selected of [false, true]) {
    const layers = skillChromeLayers(colours, selected);
    for (const scale of [1, 2.67, 3.25, 4]) {
      expect(touchChromePixel(scale, layers, { x: 24, y: 7.5 + 0.5 / scale })[3]).toBe(255);
      expect(touchChromePixel(scale, layers, { x: 24, y: 7.5 - 0.5 / scale })[3]).toBe(0);
    }
  }
});
