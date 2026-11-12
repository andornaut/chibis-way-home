// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { svgLayers } from "../../testing/chromeSvg";
import { createPaletteSvg } from "../dom/chrome";
import { SKILL_BUTTON } from "../layout/skillHud";
import { skillChromeLayers } from "./skillChrome";

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

it.each([false, true])(
  "draws the circle as vector SVG in the target's base pixels, selected %s",
  (selected) => {
    const layers = skillChromeLayers(colours, selected);
    const svg = createPaletteSvg(
      document,
      { ink: colours.ink, navy: colours.face },
      { height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
      layers,
    );
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${SKILL_BUTTON.target} ${SKILL_BUTTON.target}`);
    expect(svgLayers(svg)).toEqual(layers);
    expect([...svg.children].map((shape) => shape.getAttribute("data-ui-fill"))).toEqual(
      selected ? ["ink", "navy"] : ["navy"],
    );
  },
);

it("refuses a layer in a colour the UI does not name", () => {
  expect(() =>
    createPaletteSvg(document, { ink: colours.ink }, { height: 1, width: 1 }, [
      { colour: 0x123456, kind: "rect", rect: { height: 1, width: 1, x: 0, y: 0 } },
    ]),
  ).toThrow(/0x123456/u);
});
