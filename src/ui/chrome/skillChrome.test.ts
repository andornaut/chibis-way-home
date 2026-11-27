// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { svgLayers } from "../../testing/chromeSvg.ts";
import { createPaletteSvg } from "../dom/chrome.ts";
import { SKILL_BUTTON } from "../layout/index.ts";
import { skillChromeLayers } from "./skillChrome.ts";

const colours = { face: 0x223344, ink: 0x181425 };

it("keeps one 33px disc in the 48px target regardless of paint", () => {
  const centre = { x: 24, y: 24 };
  expect(SKILL_BUTTON).toEqual({ disc: 33, glyph: 16, target: 48 });
  for (const colour of Object.values(colours)) {
    expect(skillChromeLayers(colour)).toEqual([{ centre, colour, kind: "disc", radius: 16.5 }]);
  }
});

it("draws the disc as vector SVG in the target's base pixels", () => {
  const layers = skillChromeLayers(colours.face);
  const svg = createPaletteSvg(
    document,
    { navy: colours.face },
    { height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
    layers,
  );
  const { target } = SKILL_BUTTON;
  expect(svg.getAttribute("viewBox")).toBe(["0", "0", target, target].join(" "));
  expect(svgLayers(svg)).toEqual(layers);
  expect([...svg.children].map((shape) => shape.getAttribute("data-ui-fill"))).toEqual(["navy"]);
});

it("refuses a layer in a colour the UI does not name", () => {
  expect(() =>
    createPaletteSvg(document, { ink: colours.ink }, { height: 1, width: 1 }, [
      { colour: 0x123456, kind: "rect", rect: { height: 1, width: 1, x: 0, y: 0 } },
    ]),
  ).toThrow(/0x123456/u);
});
